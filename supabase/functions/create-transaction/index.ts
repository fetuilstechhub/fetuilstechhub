import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'http://localhost:8080';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const body = await req.json();
    const {
      full_name,
      email,
      booking_date,
      plan_id,
      plan_title,
      amount,
      workspace_id,
      start_time,
      end_time,
      duration_minutes,
      metadata,
    } = body;

    if (!email || !amount) return new Response(JSON.stringify({ error: 'missing required fields' }), { status: 400 });

    // insert pending booking
    const { data, error } = await supabase
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
          metadata: { ...(metadata || {}), booking_date },
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error', error);
      return new Response(JSON.stringify({ error: 'db_error' }), { status: 500 });
    }

    const booking = data;

    // initialize paystack transaction
    const initResp = await fetch('https://api.paystack.co/transaction/initialize', {
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

    const initJson = await initResp.json();
    if (!initJson.status) {
      console.error('Paystack init error', initJson);
      return new Response(JSON.stringify({ error: 'paystack_init_failed', details: initJson }), { status: 500 });
    }

    const { authorization_url, reference } = initJson.data;

    await supabase.from('bookings').update({ paystack_reference: reference }).eq('id', booking.id);

    return new Response(JSON.stringify({ authorization_url, reference }), { status: 200 });
  } catch (err) {
    console.error('create-transaction error', err);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500 });
  }
});
