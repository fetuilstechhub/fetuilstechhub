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
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'FETUILS TechHub <noreply@auth.zipfast.app>';
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

// Debug endpoint to check env vars
app.get('/api/health', (req, res) => {
  console.log('[HEALTH] Server is running');
  res.json({
    status: 'ok',
    port: PORT,
    supabase_configured: !!SUPABASE_URL,
    paystack_configured: !!PAYSTACK_SECRET_KEY,
    resend_configured: !!RESEND_API_KEY,
    frontend_url: FRONTEND_URL,
  });
});

// Test webhook endpoint - simulate a Paystack webhook
app.post('/api/test-webhook', async (req, res) => {
  try {
    console.log('[TEST-WEBHOOK] Simulating Paystack webhook...');
    const testReference = 'test_' + Date.now();
    
    // Create a test booking first
    const { data: booking, error: insertErr } = await supabase
      .from('bookings')
      .insert([{
        full_name: 'Test User',
        email: 'test@example.com',
        plan_id: 'test',
        plan_title: 'Test Plan',
        amount: 1000,
        currency: 'NGN',
        status: 'pending',
        paystack_reference: testReference,
        metadata: {},
      }])
      .select()
      .single();

    if (insertErr) {
      console.error('[TEST-WEBHOOK] Failed to create test booking', insertErr);
      return res.status(500).json({ error: 'failed to create test booking' });
    }

    console.log('[TEST-WEBHOOK] Test booking created:', booking.id);

    // Update to paid
    console.log('[TEST-WEBHOOK] Updating booking to paid...');
    await supabase
      .from('bookings')
      .update({ status: 'paid' })
      .eq('id', booking.id);

    // Try to send email
    if (RESEND_API_KEY) {
      console.log('[TEST-WEBHOOK] Sending test email...');
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: RESEND_FROM_EMAIL,
              to: 'test@example.com',
              subject: 'Test Email - Booking Confirmation',
              html: '<h2>This is a test email</h2><p>If you receive this, Resend is working!</p>',
            }),
          });

      const resendJson = await resendRes.json();
      if (!resendRes.ok) {
        console.error('[TEST-WEBHOOK] Resend error:', resendRes.status, resendJson);
        return res.status(500).json({ error: 'email send failed', details: resendJson });
      } else {
        console.log('[TEST-WEBHOOK] Email sent:', resendJson.id);
      }
    }

    res.json({ success: true, booking_id: booking.id, reference: testReference });
  } catch (err) {
    console.error('[TEST-WEBHOOK] Error:', err);
    res.status(500).json({ error: 'test webhook failed', details: err.message });
  }
});

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

    console.log('[CREATE-TRANSACTION] Request received:', { email, amount, plan_id });

    if (!email || !amount) {
      console.log('[CREATE-TRANSACTION] Missing required fields');
      return res.status(400).json({ error: 'missing required fields' });
    }

    // create booking record (pending)
    console.log('[CREATE-TRANSACTION] Creating booking in Supabase...');
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
      console.error('[CREATE-TRANSACTION] Supabase insert error', insertErr);
      return res.status(500).json({ error: 'db_error' });
    }

    const booking = bookingData;
    console.log('[CREATE-TRANSACTION] Booking created with ID:', booking.id);

    // initialize Paystack transaction
    // Paystack expects amount in kobo (NGN * 100)
    const callbackUrl = `${FRONTEND_URL}/booking/confirmation`;
    console.log('[CREATE-TRANSACTION] Initializing Paystack with callback:', callbackUrl);

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
        callback_url: callbackUrl,
      }),
    });

    const initJson = await initializeRes.json();
    console.log('[CREATE-TRANSACTION] Paystack response:', { status: initJson.status, reference: initJson.data?.reference });

    if (!initJson.status) {
      console.error('[CREATE-TRANSACTION] Paystack init error', initJson);
      return res.status(500).json({ error: 'paystack_init_failed', details: initJson });
    }

    const { authorization_url, reference } = initJson.data;

    // update booking with paystack reference
    console.log('[CREATE-TRANSACTION] Updating booking with Paystack reference:', reference);
    await supabase.from('bookings').update({ paystack_reference: reference }).eq('id', booking.id);

    console.log('[CREATE-TRANSACTION] Success, returning authorization URL');
    return res.json({ authorization_url, reference });
  } catch (err) {
    console.error('[CREATE-TRANSACTION] Unexpected error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/booking-status', async (req, res) => {
  try {
    const { reference, trxref } = req.query;
    const lookupReference = reference || trxref;

    console.log('[BOOKING-STATUS] Query received:', { reference, trxref });

    if (!lookupReference) {
      console.log('[BOOKING-STATUS] Missing reference');
      return res.status(400).json({ error: 'missing_reference' });
    }

    console.log('[BOOKING-STATUS] Looking up booking with reference:', lookupReference);
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('paystack_reference', lookupReference)
      .maybeSingle();

    if (error) {
      console.error('[BOOKING-STATUS] Lookup error', error);
      return res.status(500).json({ error: 'booking_lookup_failed' });
    }

    if (!data) {
      console.log('[BOOKING-STATUS] Booking not found for reference:', lookupReference);
      return res.status(404).json({ error: 'booking_not_found' });
    }

    console.log('[BOOKING-STATUS] Booking found:', { id: data.id, status: data.status });
    return res.json(data);
  } catch (err) {
    console.error('[BOOKING-STATUS] Unexpected error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Paystack webhook - raw body required for signature verification
app.post('/api/webhook', async (req, res) => {
  try {
    console.log('[WEBHOOK] Received request');
    const signature = req.header('x-paystack-signature');
    const body = req.body; // Buffer from express.raw()

    console.log('[WEBHOOK] Signature present:', !!signature);
    console.log('[WEBHOOK] Body type:', typeof body, 'is buffer:', Buffer.isBuffer(body));

    if (!Buffer.isBuffer(body)) {
      console.error('[WEBHOOK] Body is not raw buffer', typeof body);
      return res.status(400).send('invalid webhook body');
    }

    // verify signature
    console.log('[WEBHOOK] Verifying signature...');
    const hmac = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY || '');
    hmac.update(body);
    const digest = hmac.digest('hex');

    console.log('[WEBHOOK] Expected signature:', digest);
    console.log('[WEBHOOK] Received signature:', signature);

    if (signature !== digest) {
      console.warn('[WEBHOOK] Invalid Paystack signature');
      return res.status(400).send('invalid signature');
    }

    console.log('[WEBHOOK] Signature verified, parsing payload...');
    const payload = JSON.parse(body.toString());
    const event = payload;

    console.log('[WEBHOOK] Event type:', event.event);
    console.log('[WEBHOOK] Event data:', JSON.stringify(event.data, null, 2));

    // interested in transaction.success
    if (event.event === 'charge.success' || event.event === 'transfer.success' || event.event === 'invoice.paid' || (event.data && event.data.status === 'success')) {
      const reference = event.data.reference;
      console.log('[WEBHOOK] Processing successful payment with reference:', reference);

      // update booking status
      console.log('[WEBHOOK] Updating booking status to paid...');
      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ status: 'paid', paystack_reference: reference })
        .eq('paystack_reference', reference);

      if (updateErr) {
        console.error('[WEBHOOK] Booking update error', updateErr);
      } else {
        console.log('[WEBHOOK] Booking status updated successfully');
      }

      // fetch booking to include details in email
      console.log('[WEBHOOK] Fetching booking details for email...');
      const { data: booking } = await supabase.from('bookings').select('*').eq('paystack_reference', reference).maybeSingle();

      if (!booking) {
        console.error('[WEBHOOK] Booking not found after update');
      } else {
        console.log('[WEBHOOK] Booking found:', { id: booking.id, email: booking.email });
      }

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

          console.log('[WEBHOOK] Sending email to:', booking.email);
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: RESEND_FROM_EMAIL,
              to: booking.email,
              subject: `Booking confirmation — ${booking.plan_title}`,
              html: emailHtml,
            }),
          });
          
          console.log('[WEBHOOK] Resend API response status:', resendRes.status);
          const resendJson = await resendRes.json();
          
          if (!resendRes.ok) {
            console.error('[WEBHOOK] Resend API error', resendRes.status, resendJson);
          } else {
            console.log('[WEBHOOK] Email sent successfully:', resendJson.id);
          }
        } catch (err) {
          console.error('[WEBHOOK] Error sending email via Resend', err);
        }
      } else {
        if (!RESEND_API_KEY) {
          console.warn('[WEBHOOK] Resend API key not configured');
        }
        if (!booking) {
          console.warn('[WEBHOOK] Booking not found, skipping email');
        }
      }
    } else {
      console.log('[WEBHOOK] Event not a success event, ignoring');
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('[WEBHOOK] Unexpected error', err);
    res.status(500).send('server error');
  }
});

app.listen(PORT, () => console.log(`[SERVER] Server running on port ${PORT}`));
