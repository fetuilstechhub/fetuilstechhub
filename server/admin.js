// Admin API: payments, bookings, check-ins, events and the overview numbers.
// Signed in with ADMIN_PIN, which is separate from the guards' STAFF_PIN.
import crypto from 'crypto';
import { Router } from 'express';
import { pinAuth, safeEqual } from './auth.js';
import { EVENT_PLAN, eventDetails, insertEvent, publicEvent } from './events.js';
import { passCode } from './pass-email.js';
import { PLANS, validUntil } from './plans.js';

const MIN_PIN_LENGTH = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const WAITING_DAYS = 14;
const REFERENCE_RE = /^[\w.=-]{1,100}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const STATUSES = ['pending', 'paid', 'cancelled', 'failed'];
const BOOKING_COLUMNS = 'id,full_name,email,plan_id,plan_title,amount,paystack_reference,metadata,created_at,status';

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const lagosDay = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const addDays = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// The day money came in: when staff confirmed a transfer, or when an online payment was made.
const receivedOn = (b) => lagosDay(new Date(b.metadata?.payment_confirmed_at || b.created_at));

export const bookingRow = (b) => ({
  reference: b.paystack_reference,
  code: passCode(b.paystack_reference),
  holder: b.full_name,
  email: b.email,
  plan_id: b.plan_id,
  plan_title: b.plan_title,
  amount: b.amount,
  starts_on: b.metadata?.booking_date ?? null,
  valid_until: b.metadata?.valid_until ?? null,
  notes: b.metadata?.notes ?? '',
  booked_at: b.created_at,
  paid_at: b.status === 'paid' ? b.metadata?.payment_confirmed_at ?? b.created_at : null,
  payment_method: b.metadata?.payment_method ?? (b.status === 'paid' ? 'paystack' : null),
  source: b.metadata?.source ?? 'web',
  status: b.status,
});

export function adminRouter({ supabase, limiter, markPaid, sendConfirmationEmail, adminPin, tokenSecret, staffPin }) {
  const router = Router();
  // A guard who knows the door PIN must never be able to open the admin.
  const samePin = typeof adminPin === 'string' && typeof staffPin === 'string' && adminPin.length > 0 && safeEqual(adminPin, staffPin);
  if (samePin) console.warn('ADMIN_PIN is the same as STAFF_PIN: admin sign-in is disabled until they differ');
  const auth = pinAuth({
    pin: samePin ? '' : adminPin,
    secret: tokenSecret,
    scope: 'admin',
    minLength: MIN_PIN_LENGTH,
    name: 'ADMIN_PIN',
    limiter,
    // Shorter than the door scanner's week, so a lost or shared device signs itself out.
    lifetimeMs: 12 * 60 * 60 * 1000,
  });
  const requireAdmin = auth.requireAuth;

  const guarded = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[ADMIN] Failed', err.message);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
  const route = (method, path, handler, max = 300) => router[method](path, limiter(max), requireAdmin, guarded(handler));

  async function findBooking(reference) {
    if (typeof reference !== 'string' || !REFERENCE_RE.test(reference)) return null;
    const { data, error } = await supabase.from('bookings').select('*').eq('paystack_reference', reference).maybeSingle();
    if (error) throw new Error(`Booking lookup failed: ${error.message}`);
    return data;
  }

  async function guestCounts(eventIds) {
    if (!eventIds.length) return new Map();
    const { data, error } = await supabase.from('event_registrations').select('event_id').in('event_id', eventIds);
    if (error) throw new Error(`Guests lookup failed: ${error.message}`);
    const counts = new Map();
    for (const g of data) counts.set(g.event_id, (counts.get(g.event_id) ?? 0) + 1);
    return counts;
  }

  // Saves a booking made by staff, for walk-ins and anyone who paid directly.
  async function createBooking({ fullName, email, planId, date, notes, amount }) {
    const reference = `fet_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const { data, error } = await supabase
      .from('bookings')
      .insert([{
        full_name: fullName,
        email,
        plan_id: planId,
        plan_title: PLANS[planId].title,
        amount,
        currency: 'NGN',
        start_time: `${date}T09:00:00.000Z`,
        status: 'pending',
        paystack_reference: reference,
        metadata: { source: 'admin', booking_date: date, valid_until: validUntil(date, planId), notes },
      }])
      .select()
      .single();
    if (error) throw new Error(`Booking insert failed: ${error.message}`);
    return data;
  }

  const confirmTransfer = (booking) =>
    markPaid(booking, { ...booking.metadata, payment_method: 'transfer', payment_confirmed_at: new Date().toISOString() });

  // Shared checks for a booking typed in by staff. Returns clean values or an error.
  function bookingInput(body, planId) {
    const fullName = text(body.full_name, 120).replace(/\s+/g, ' ');
    const email = text(body.email, 254).toLowerCase();
    const date = text(body.date, 10);
    if (!Object.hasOwn(PLANS, planId ?? '')) return { error: 'Please choose a plan.' };
    if (!fullName) return { error: 'Please enter a full name.' };
    if (!EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.' };
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) return { error: 'Please choose a date.' };
    let amount = PLANS[planId].price;
    if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
      amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount < 0 || amount > 10_000_000) return { error: 'Please enter the amount received in naira.' };
    }
    return { fullName, email, planId, date, notes: text(body.notes, 1000), amount };
  }

  router.post('/login', ...auth.login('The admin is not set up yet. Add ADMIN_PIN in Render.'));

  route('get', '/overview', async (req, res) => {
    const today = lagosDay();
    const monthStart = `${today.slice(0, 8)}01`;
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday is 0
    const weekStart = addDays(today, -weekday);
    const since = new Date(Date.now() - 70 * DAY_MS).toISOString();
    const waitingSince = new Date(Date.now() - WAITING_DAYS * DAY_MS).toISOString();

    const [paid, waiting, checkIns, events] = await Promise.all([
      supabase.from('bookings').select(BOOKING_COLUMNS).eq('status', 'paid').gte('created_at', since).order('created_at', { ascending: false }).limit(1000),
      supabase.from('bookings').select('id').eq('status', 'pending').gte('created_at', waitingSince).limit(500),
      supabase.from('check_ins').select('id').eq('check_in_date', today).limit(1000),
      supabase.from('events').select('*').gte('starts_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()).order('starts_at', { ascending: true }).limit(5),
    ]);
    const failed = [paid, waiting, checkIns, events].find((r) => r.error);
    if (failed) throw new Error(`Overview lookup failed: ${failed.error.message}`);

    const sum = (rows) => rows.reduce((total, b) => total + Number(b.amount || 0), 0);
    const inRange = (from) => paid.data.filter((b) => receivedOn(b) >= from && receivedOn(b) <= today);
    const month = inRange(monthStart);
    const byPlan = new Map();
    for (const b of month) {
      const entry = byPlan.get(b.plan_title) ?? { plan: b.plan_title, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += Number(b.amount || 0);
      byPlan.set(b.plan_title, entry);
    }
    const daily = [];
    for (let i = 13; i >= 0; i--) {
      const day = addDays(today, -i);
      const rows = paid.data.filter((b) => receivedOn(b) === day);
      daily.push({ day, amount: sum(rows), count: rows.length });
    }
    const active = paid.data.filter((b) => {
      const start = b.metadata?.booking_date;
      const end = b.metadata?.valid_until;
      return start && end && start <= today && today <= end;
    });
    const counts = await guestCounts(events.data.map((e) => e.id));

    return res.json({
      today,
      revenue: {
        today: sum(inRange(today)),
        week: sum(inRange(weekStart)),
        month: sum(month),
        month_payments: month.length,
      },
      by_plan: [...byPlan.values()].sort((a, b) => b.amount - a.amount),
      daily,
      waiting_payments: waiting.data.length,
      check_ins_today: checkIns.data.length,
      active_passes: active.length,
      upcoming_events: events.data.map((e) => ({ ...publicEvent(e), id: e.id, guests: counts.get(e.id) ?? 0 })),
    });
  });

  route('get', '/payments', async (req, res) => {
    const since = new Date(Date.now() - WAITING_DAYS * DAY_MS).toISOString();
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('status', 'pending')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(`Payments lookup failed: ${error.message}`);
    return res.json({ waiting: data.map(bookingRow) });
  });

  // Releases a pass after a person has seen the transfer in the bank account.
  route('post', '/confirm-payment', async (req, res) => {
    const booking = await findBooking(req.body?.reference);
    if (!booking) return res.status(404).json({ error: 'not_found' });
    if (booking.status === 'paid') return res.json({ already_paid: true, email_sent: false, booking: bookingRow(booking) });
    if (booking.status !== 'pending') return res.status(409).json({ error: 'not_pending' });
    const result = await confirmTransfer(booking);
    return res.json({ already_paid: result.alreadyPaid, email_sent: result.emailSent, booking: bookingRow(result.booking) });
  });

  route('get', '/bookings', async (req, res) => {
    let query = supabase.from('bookings').select(BOOKING_COLUMNS);
    if (STATUSES.includes(req.query.status)) query = query.eq('status', req.query.status);
    if (typeof req.query.plan === 'string' && Object.hasOwn(PLANS, req.query.plan)) query = query.eq('plan_id', req.query.plan);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
    if (error) throw new Error(`Bookings lookup failed: ${error.message}`);
    return res.json({ bookings: data.map(bookingRow) });
  });

  route('post', '/bookings', async (req, res) => {
    const body = req.body || {};
    const input = bookingInput(body, body.plan_id);
    if (input.error) return res.status(400).json({ error: input.error });
    const booking = await createBooking(input);
    if (body.paid !== true) return res.json({ booking: bookingRow(booking), email_sent: false });
    const result = await confirmTransfer(booking);
    return res.json({ booking: bookingRow(result.booking), email_sent: result.emailSent });
  }, 60);

  route('post', '/bookings/resend', async (req, res) => {
    const booking = await findBooking(req.body?.reference);
    if (!booking) return res.status(404).json({ error: 'not_found' });
    if (booking.status !== 'paid') return res.status(409).json({ error: 'Only paid bookings have a pass to send.' });
    try {
      await sendConfirmationEmail(booking);
      return res.json({ email_sent: true });
    } catch (err) {
      console.error('[ADMIN] Resend failed', booking.id, err.message);
      return res.json({ email_sent: false });
    }
  }, 60);

  route('post', '/bookings/cancel', async (req, res) => {
    const booking = await findBooking(req.body?.reference);
    if (!booking) return res.status(404).json({ error: 'not_found' });
    if (booking.status !== 'pending') return res.status(409).json({ error: 'Only unpaid bookings can be cancelled.' });
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id).eq('status', 'pending');
    if (error) throw new Error(`Cancel failed: ${error.message}`);
    return res.json({ ok: true });
  });

  route('get', '/check-ins', async (req, res) => {
    const day = DATE_RE.test(req.query.date ?? '') ? req.query.date : lagosDay();
    const { data: entries, error } = await supabase
      .from('check_ins')
      .select('booking_id,slot,created_at')
      .eq('check_in_date', day)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw new Error(`Check-ins lookup failed: ${error.message}`);
    const ids = [...new Set(entries.map((e) => e.booking_id))];
    const { data: bookings, error: bookingsError } = ids.length
      ? await supabase.from('bookings').select('id,full_name,plan_title,paystack_reference').in('id', ids)
      : { data: [], error: null };
    if (bookingsError) throw new Error(`Check-ins lookup failed: ${bookingsError.message}`);
    const byId = new Map(bookings.map((b) => [b.id, b]));
    return res.json({
      date: day,
      entries: entries.map((e) => {
        const b = byId.get(e.booking_id);
        return { at: e.created_at, holder: b?.full_name ?? 'Unknown', plan_title: b?.plan_title ?? '', code: b ? passCode(b.paystack_reference) : '' };
      }),
    });
  });

  route('get', '/events', async (req, res) => {
    const { data: events, error } = await supabase.from('events').select('*').order('starts_at', { ascending: false }).limit(200);
    if (error) throw new Error(`Events lookup failed: ${error.message}`);
    const counts = await guestCounts(events.map((e) => e.id));
    const bookingIds = events.map((e) => e.booking_id);
    const { data: bookings, error: bookingsError } = bookingIds.length
      ? await supabase.from('bookings').select('id,paystack_reference').in('id', bookingIds)
      : { data: [], error: null };
    if (bookingsError) throw new Error(`Events lookup failed: ${bookingsError.message}`);
    const refs = new Map(bookings.map((b) => [b.id, b.paystack_reference]));
    return res.json({
      events: events.map((e) => ({
        ...publicEvent(e),
        id: e.id,
        organiser_email: e.organiser_email,
        reference: refs.get(e.booking_id) ?? null,
        guests: counts.get(e.id) ?? 0,
      })),
    });
  });

  // For organisers who have already paid: one form creates the paid booking,
  // emails their pass and makes the event page.
  route('post', '/events', async (req, res) => {
    const body = req.body || {};
    const input = bookingInput({ ...body, full_name: body.organiser_name, email: body.organiser_email }, EVENT_PLAN);
    if (input.error) return res.status(400).json({ error: input.error });
    const details = eventDetails(body, input.date);
    if (details.error) return res.status(400).json({ error: details.error });

    const booking = await createBooking(input);
    const paid = await confirmTransfer(booking);
    const event = await insertEvent(supabase, paid.booking, details);
    return res.json({
      event: { ...publicEvent(event), id: event.id, reference: booking.paystack_reference },
      email_sent: paid.emailSent,
    });
  }, 60);

  route('get', '/events/:id/guests', async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
    const { data, error } = await supabase
      .from('event_registrations')
      .select('full_name,email,created_at')
      .eq('event_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Guests lookup failed: ${error.message}`);
    return res.json({ guests: data.map((g) => ({ name: g.full_name, email: g.email, registered_at: g.created_at })) });
  });

  // Everyone registered for any event, newest first.
  route('get', '/guests', async (req, res) => {
    const { data: guests, error } = await supabase
      .from('event_registrations')
      .select('event_id,full_name,email,created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw new Error(`Guests lookup failed: ${error.message}`);
    const ids = [...new Set(guests.map((g) => g.event_id))];
    const { data: events, error: eventsError } = ids.length
      ? await supabase.from('events').select('id,title,starts_at').in('id', ids)
      : { data: [], error: null };
    if (eventsError) throw new Error(`Events lookup failed: ${eventsError.message}`);
    const byId = new Map(events.map((e) => [e.id, e]));
    return res.json({
      guests: guests.map((g) => ({
        name: g.full_name,
        email: g.email,
        registered_at: g.created_at,
        event_title: byId.get(g.event_id)?.title ?? 'Removed event',
        event_starts_at: byId.get(g.event_id)?.starts_at ?? null,
      })),
    });
  });

  // Takes the event page down and removes its guest list. The organiser's booking stays.
  route('delete', '/events/:id', async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
    const guests = await supabase.from('event_registrations').delete().eq('event_id', req.params.id);
    if (guests.error) throw new Error(`Guest delete failed: ${guests.error.message}`);
    const { data, error } = await supabase.from('events').delete().eq('id', req.params.id).select();
    if (error) throw new Error(`Event delete failed: ${error.message}`);
    if (!data.length) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true });
  });

  return router;
}
