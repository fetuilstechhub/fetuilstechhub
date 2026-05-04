import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();

const PORT = process.env.PORT || 8787;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase config in env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const app = express();

app.use(cors());
app.use('/api/webhook', express.raw({ type: '*/*' }));
app.use(express.json());

// Create Paystack transaction and persist booking as pending
app.post('/api/create-transaction', async (req, res) => {
  try {
    const {
      full_name,
      email,
      booking_date,
      plan_id,
      plan_title,
      amount, // in whole NGN
      workspace_id,
      start_time,
      end_time,
      duration_minutes,
      metadata,
    } = req.body;

    if (!email || !amount) return res.status(400).json({ error: 'missing required fields' });

    // create booking record (pending)
    const { data: bookingData, error: insertErr } = await supabase
      .from('bookings')
      .insert([
        {
          full_name,
          email,
          plan_id,
          plan_title,
          amount: Math.round(amount),
          currency: 'NGN',
          workspace_id,
          start_time,
          end_time,
          duration_minutes,
          status: 'pending',
          metadata: metadata || {},
        },
      ])
      .select()
      .single();

    if (insertErr) {
      console.error('Supabase insert error', insertErr);
      return res.status(500).json({ error: 'db_error' });
    }

    const booking = bookingData;

    // initialize Paystack transaction
    // Paystack expects amount in kobo (NGN * 100)
    const initializeRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount) * 100,
        metadata: { booking_id: booking.id, ...(metadata || {}) },
        callback_url: `${FRONTEND_URL}/booking/confirmation`,
      }),
    });

    const initJson = await initializeRes.json();

    if (!initJson.status) {
      console.error('Paystack init error', initJson);
      return res.status(500).json({ error: 'paystack_init_failed', details: initJson });
    }

    const { authorization_url, reference } = initJson.data;

    // update booking with paystack reference
    await supabase.from('bookings').update({ paystack_reference: reference }).eq('id', booking.id);

    return res.json({ authorization_url, reference });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/booking-status', async (req, res) => {
  try {
    const { reference, trxref } = req.query;
    const lookupReference = reference || trxref;

    if (!lookupReference) {
      return res.status(400).json({ error: 'missing_reference' });
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('paystack_reference', lookupReference)
      .maybeSingle();

    if (error) {
      console.error('Booking status lookup error', error);
      return res.status(500).json({ error: 'booking_lookup_failed' });
    }

    if (!data) {
      return res.status(404).json({ error: 'booking_not_found' });
    }

    return res.json(data);
  } catch (err) {
    console.error('booking status error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Paystack webhook - raw body required for signature verification
app.post('/api/webhook', async (req, res) => {
  try {
    const signature = req.header('x-paystack-signature');
    const body = req.body; // Buffer from express.raw()

    if (!Buffer.isBuffer(body)) {
      console.error('Webhook body is not raw buffer', typeof body);
      return res.status(400).send('invalid webhook body');
    }

    // verify signature
    const hmac = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY || '');
    hmac.update(body);
    const digest = hmac.digest('hex');

    if (signature !== digest) {
      console.warn('Invalid Paystack signature');
      return res.status(400).send('invalid signature');
    }

    const payload = JSON.parse(body.toString());
    const event = payload;

    // interested in transaction.success
    if (event.event === 'charge.success' || event.event === 'transfer.success' || event.event === 'invoice.paid' || (event.data && event.data.status === 'success')) {
      const reference = event.data.reference;

      // update booking status
      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ status: 'paid', paystack_reference: reference })
        .eq('paystack_reference', reference);

      if (updateErr) {
        console.error('Booking update error', updateErr);
      }

      // fetch booking to include details in email
      const { data: booking } = await supabase.from('bookings').select('*').eq('paystack_reference', reference).maybeSingle();

      // send order summary email via Resend if available
      if (RESEND_API_KEY && booking) {
        try {
          const displayDate = booking?.metadata?.booking_date || booking?.start_time || 'Not specified';
          const emailHtml = `<h2>Booking Confirmation</h2>
          <p>Hi ${booking.full_name || booking.email},</p>
          <p>We received your payment for <strong>${booking.plan_title}</strong> (₦${booking.amount}).</p>
          <p><strong>Booked Date:</strong> ${displayDate}</p>
          <p>Reference: ${reference}</p>
          <p>Thank you — see you soon.</p>`;

          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'FETUILS TechHub <noreply@auth.zipfast.app>',
              to: booking.email,
              subject: `Booking confirmation — ${booking.plan_title}`,
              html: emailHtml,
            }),
          });
          const resendJson = await resendRes.json();
          if (!resendRes.ok) {
            console.error('Resend API error', resendRes.status, resendJson);
          } else {
            console.log('Email sent successfully:', resendJson.id);
          }
        } catch (err) {
          console.error('Error sending email via Resend', err);
        }
      }
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('webhook processing error', err);
    res.status(500).send('server error');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
