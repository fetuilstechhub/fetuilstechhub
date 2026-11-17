import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { PLANS, validUntil } from './plans.js';
import { escapeHtml, passCode, passEmailHtml } from './pass-email.js';
import { doorRouter } from './door.js';
import { eventsRouter } from './events.js';

dotenv.config();

const PORT = process.env.PORT || 8787;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'FETUILS TechHub <noreply@fetuils.ng>';
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'fetuilstechhub@gmail.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
const PAYSTACK_API_BASE = process.env.PAYSTACK_API_BASE || 'https://api.paystack.co';
const RESEND_API_BASE = process.env.RESEND_API_BASE || 'https://api.resend.com';
// Until Paystack is live, customers pay by bank transfer and staff confirm it at /door/payments.
// Paystack stays fully off in this mode, so a test key can never produce a real pass.
const ONLINE_PAYMENTS = process.env.PAYMENT_MODE === 'paystack';

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', ...(ONLINE_PAYMENTS ? ['PAYSTACK_SECRET_KEY'] : [])];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}
if (!RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set: confirmation emails and the contact form will not work');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REFERENCE_RE = /^[\w.=-]{1,100}$/;

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const todayInLagos = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

function allowedOrigins() {
  const origins = new Set(['https://fetuilstechhub.vercel.app', 'http://localhost:8080']);
  const url = new URL(FRONTEND_URL);
  origins.add(url.origin);
  // fetuils.ng redirects to www, so allow both forms of the site's address.
  if (url.protocol === 'https:') {
    const bare = url.hostname.replace(/^www\./, '');
    origins.add(`https://${bare}`);
    origins.add(`https://www.${bare}`);
  }
  for (const origin of (process.env.ALLOWED_ORIGINS || '').split(',')) {
    if (origin.trim()) origins.add(origin.trim());
  }
  return origins;
}

const limiter = (max) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again in a few minutes.' },
  });

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
  next();
});

// Render sits in front of the app as one proxy, so rate limits see the real client IP.
app.set('trust proxy', 1);

const origins = allowedOrigins();
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.has(origin)) }));
app.use('/api/webhook', express.raw({ type: '*/*' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function sendEmail(payload) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const response = await fetch(`${RESEND_API_BASE}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, ...payload }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
  }
}

async function sendConfirmationEmail(booking) {
  await sendEmail({
    to: booking.email,
    subject: `Your FETUILS TechHub pass: ${String(booking.plan_title).replace(/[\r\n]/g, ' ')}`,
    html: passEmailHtml({ booking, frontendUrl: FRONTEND_URL }),
  });
}

// Safe to call repeatedly: only the call that moves the booking from pending to paid
// sends the email. Throws on database errors so the webhook can ask Paystack to retry.
async function markPaid(booking, metadata = booking.metadata) {
  const { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'paid', metadata })
    .eq('id', booking.id)
    .eq('status', 'pending')
    .select();
  if (updateError) throw new Error(`Booking update failed: ${updateError.message}`);
  if (!updated.length) return { booking: { ...booking, status: 'paid' }, emailSent: false, alreadyPaid: true };

  try {
    await sendConfirmationEmail(updated[0]);
    return { booking: updated[0], emailSent: true, alreadyPaid: false };
  } catch (err) {
    console.error('[PAYMENT] Confirmation email failed for booking', booking.id, err.message);
    return { booking: updated[0], emailSent: false, alreadyPaid: false };
  }
}

// Marks a booking paid after a confirmed Paystack charge.
async function settlePayment({ reference, paidKobo, currency }) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('paystack_reference', reference)
    .maybeSingle();
  if (error) throw new Error(`Booking lookup failed: ${error.message}`);
  if (!booking) {
    console.warn('[PAYMENT] No booking for reference', reference);
    return null;
  }
  if (booking.status !== 'pending') return booking;

  if (currency !== booking.currency || paidKobo < booking.amount * 100) {
    console.error('[PAYMENT] Amount mismatch, leaving booking pending', { id: booking.id, paidKobo, currency });
    return booking;
  }

  return (await markPaid(booking)).booking;
}

// The webhook may be late or may have failed, so ask Paystack directly.
async function confirmIfPending(booking) {
  if (!ONLINE_PAYMENTS || booking.status !== 'pending') return booking;
  try {
    const verifyResponse = await fetch(
      `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(booking.paystack_reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const verify = await verifyResponse.json();
    if (verifyResponse.ok && verify.data?.status === 'success') {
      const settled = await settlePayment({
        reference: booking.paystack_reference,
        paidKobo: verify.data.amount,
        currency: verify.data.currency,
      });
      return settled || booking;
    }
  } catch (err) {
    console.error('[PAYMENT] Paystack verify failed', err.message);
  }
  return booking;
}

function whatsappMessage({ fullName, email, planTitle, amount, bookingDate, reference }) {
  const startDate = new Date(`${bookingDate}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  });
  return [
    "Hi FETUILS TechHub, I'd like to book and pay by transfer.",
    '',
    `Name: ${fullName.replace(/\s+/g, ' ')}`,
    `Email: ${email}`,
    `Plan: ${planTitle}`,
    `Amount: ₦${amount.toLocaleString('en-NG')}`,
    `Start date: ${startDate}`,
    `Booking code: ${passCode(reference)}`,
    '',
    'Please send me your account details.',
  ].join('\n');
}

app.post('/api/create-transaction', limiter(30), async (req, res) => {
  try {
    const body = req.body || {};
    const fullName = text(body.full_name, 120);
    const email = text(body.email, 254);
    const bookingDate = text(body.booking_date, 10);
    const notes = text(body.notes, 1000);
    const plan = typeof body.plan_id === 'string' && Object.hasOwn(PLANS, body.plan_id) ? PLANS[body.plan_id] : null;

    if (!plan) return res.status(400).json({ error: 'Please choose a valid plan.' });
    if (!fullName) return res.status(400).json({ error: 'Please enter your full name.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!DATE_RE.test(bookingDate) || Number.isNaN(Date.parse(bookingDate)) || bookingDate < todayInLagos()) {
      return res.status(400).json({ error: 'Please choose a booking date from today onwards.' });
    }

    // Our own reference means the booking can always be matched to its payment.
    const reference = `fet_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert([
        {
          full_name: fullName,
          email,
          plan_id: body.plan_id,
          plan_title: plan.title,
          amount: plan.price,
          currency: 'NGN',
          start_time: `${bookingDate}T09:00:00.000Z`,
          status: 'pending',
          paystack_reference: reference,
          metadata: {
            source: 'web',
            booking_date: bookingDate,
            valid_until: validUntil(bookingDate, body.plan_id),
            notes,
          },
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('[CREATE-TRANSACTION] Booking insert failed', insertError.message);
      return res.status(500).json({ error: 'We could not save your booking. Please try again.' });
    }

    if (!ONLINE_PAYMENTS) {
      return res.json({
        reference,
        whatsapp_message: whatsappMessage({
          fullName,
          email,
          planTitle: plan.title,
          amount: plan.price,
          bookingDate,
          reference,
        }),
      });
    }

    const paystackResponse = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: plan.price * 100, // Paystack amounts are in kobo
        currency: 'NGN',
        reference,
        metadata: { booking_id: booking.id, plan_id: body.plan_id },
        callback_url: `${FRONTEND_URL}/booking/confirmation`,
      }),
    });
    const paystack = await paystackResponse.json().catch(() => ({}));

    if (!paystackResponse.ok || !paystack.status || !paystack.data?.authorization_url) {
      console.error('[CREATE-TRANSACTION] Paystack init failed', paystackResponse.status, paystack.message);
      await supabase.from('bookings').update({ status: 'failed' }).eq('id', booking.id);
      return res.status(502).json({ error: 'We could not start your payment. Please try again.' });
    }

    return res.json({ authorization_url: paystack.data.authorization_url, reference });
  } catch (err) {
    console.error('[CREATE-TRANSACTION] Unexpected error', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.get('/api/booking-status', limiter(120), async (req, res) => {
  try {
    const reference = text(req.query.reference || req.query.trxref, 100);
    if (!REFERENCE_RE.test(reference)) return res.status(400).json({ error: 'missing_reference' });

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('paystack_reference', reference)
      .maybeSingle();
    if (error) {
      console.error('[BOOKING-STATUS] Lookup failed', error.message);
      return res.status(500).json({ error: 'booking_lookup_failed' });
    }
    if (!data) return res.status(404).json({ error: 'booking_not_found' });

    const booking = await confirmIfPending(data);

    return res.json({
      status: booking.status,
      plan_title: booking.plan_title,
      full_name: booking.full_name,
      email: booking.email,
      amount: booking.amount,
      currency: booking.currency,
      booking_date: booking.metadata?.booking_date || null,
      valid_until: booking.metadata?.valid_until || null,
    });
  } catch (err) {
    console.error('[BOOKING-STATUS] Unexpected error', err.message);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Paystack webhook: needs the raw body to verify the signature.
app.post('/api/webhook', async (req, res) => {
  if (!ONLINE_PAYMENTS) return res.status(200).send('ignored');
  try {
    const signature = req.header('x-paystack-signature');
    if (!Buffer.isBuffer(req.body) || !signature) return res.status(401).send('invalid signature');

    const expected = Buffer.from(crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(req.body).digest('hex'));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      console.warn('[WEBHOOK] Invalid signature');
      return res.status(401).send('invalid signature');
    }

    const event = JSON.parse(req.body.toString());
    if (event.event === 'charge.success' && event.data?.reference) {
      await settlePayment({
        reference: event.data.reference,
        paidKobo: event.data.amount,
        currency: event.data.currency,
      });
    }
    return res.status(200).send('ok');
  } catch (err) {
    // A non-200 response makes Paystack retry, so a paid booking isn't lost.
    console.error('[WEBHOOK] Failed', err.message);
    return res.status(500).send('server error');
  }
});

app.post('/api/contact', limiter(10), async (req, res) => {
  try {
    const body = req.body || {};
    // Hidden form field that only bots fill in. Pretend success so they move on.
    if (body.website) return res.json({ ok: true });

    const name = text(body.name, 120);
    const email = text(body.email, 254);
    const subject = text(body.subject, 150).replace(/[\r\n]+/g, ' ');
    const message = text(body.message, 5000);

    if (!name) return res.status(400).json({ error: 'Please enter your name.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!message) return res.status(400).json({ error: 'Please enter a message.' });

    await sendEmail({
      to: CONTACT_TO_EMAIL,
      reply_to: email,
      subject: `Website enquiry: ${subject || name.replace(/[\r\n]+/g, ' ')}`,
      html: `<p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
        ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ''}
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[CONTACT] Failed', err.message);
    return res.status(502).json({ error: 'We could not send your message.' });
  }
});

app.use(
  '/api/door',
  doorRouter({
    supabase,
    limiter,
    confirmIfPending,
    markPaid,
    staffPin: process.env.STAFF_PIN,
    tokenSecret: SUPABASE_SERVICE_ROLE_KEY,
  }),
);

app.use('/api/events', eventsRouter({ supabase, limiter, sendEmail, frontendUrl: FRONTEND_URL }));

// Bad JSON and similar errors: reply with JSON rather than an HTML stack trace.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  return res.status(err.status || 500).json({ error: 'bad_request' });
});

app.listen(PORT, () => console.log(`[SERVER] Server running on port ${PORT}`));
