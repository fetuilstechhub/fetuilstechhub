import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Helper to compute HMAC SHA512 hex
async function hmacSha512Hex(secret: string, message: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, message);
  const arr = Array.from(new Uint8Array(sig));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const raw = new Uint8Array(await req.arrayBuffer());
    const signature = req.headers.get('x-paystack-signature') || '';

    const expected = await hmacSha512Hex(PAYSTACK_SECRET_KEY, raw);
    if (signature !== expected) {
      console.warn('Invalid Paystack signature');
      return new Response('invalid signature', { status: 400 });
    }

    const payloadText = new TextDecoder().decode(raw);
    const event = JSON.parse(payloadText);

    // Only handle successful charges
    const status = event?.data?.status;
    const reference = event?.data?.reference;

    if (status === 'success' && reference) {
      // mark booking paid
      const { error: updateErr } = await supabase.from('bookings').update({ status: 'paid', paystack_reference: reference }).eq('paystack_reference', reference);
      if (updateErr) console.error('Update error', updateErr);

      const { data: booking } = await supabase.from('bookings').select('*').eq('paystack_reference', reference).maybeSingle();

      if (RESEND_API_KEY && booking) {
        const displayDate = booking?.metadata?.booking_date || booking?.start_time || 'Not specified';
        const emailHtml = `<h2>Booking Confirmation</h2>
          <p>Hi ${booking.full_name || booking.email},</p>
          <p>We received your payment for <strong>${booking.plan_title}</strong> (₦${booking.amount}).</p>
          <p><strong>Booked Date:</strong> ${displayDate}</p>
          <p>Reference: ${reference}</p>
          <p>Thank you — see you soon.</p>`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: 'FETUILS TechHub <no-reply@fetuils.example.com>', to: booking.email, subject: `Booking confirmation — ${booking.plan_title}`, html: emailHtml }),
        });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('webhook error', err);
    return new Response('server_error', { status: 500 });
  }
});
