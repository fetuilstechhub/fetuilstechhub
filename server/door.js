// Door scanner API. The system decides who gets in; the guard follows the colour.
import crypto from 'crypto';
import { Router } from 'express';
import { passCode } from './pass-email.js';
import { PLANS, validUntil } from './plans.js';
import { publicEvent } from './events.js';

const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PIN_LENGTH = 6;
const MAX_PHOTO_LENGTH = 80_000;
const PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const REFERENCE_RE = /^[\w.=-]{1,100}$/;
const CODE_RE = /^FET-?([A-Z0-9]{8})$/i;
const UNIQUE_VIOLATION = '23505';
const WAITING_DAYS = 14;

const lagosDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const sha256 = (value) => crypto.createHash('sha256').update(value).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b));

export function doorRouter({ supabase, limiter, confirmIfPending, markPaid, staffPin, tokenSecret }) {
  const router = Router();
  const pinConfigured = typeof staffPin === 'string' && staffPin.length >= MIN_PIN_LENGTH;
  if (!pinConfigured) console.warn(`STAFF_PIN must be at least ${MIN_PIN_LENGTH} characters: door scanner is disabled`);

  // Changing STAFF_PIN signs out every phone, which is how a leaked PIN gets revoked.
  const sign = (expires) =>
    crypto.createHmac('sha256', `${staffPin}:${tokenSecret}`).update(`door:${expires}`).digest('hex');

  const requireStaff = (req, res, next) => {
    const [expires, signature] = (req.header('authorization') || '').replace(/^Bearer /, '').split('.');
    if (!pinConfigured || !expires || !signature || Number(expires) < Date.now() || !safeEqual(signature, sign(expires))) {
      return res.status(401).json({ error: 'sign_in_required' });
    }
    return next();
  };

  async function findBooking({ reference, code }) {
    if (typeof reference === 'string' && REFERENCE_RE.test(reference)) {
      const { data, error } = await supabase.from('bookings').select('*').eq('paystack_reference', reference).maybeSingle();
      if (error) throw new Error(`Booking lookup failed: ${error.message}`);
      return data;
    }
    const match = typeof code === 'string' ? code.trim().match(CODE_RE) : null;
    if (!match) return null;
    for (const pattern of [`fet_${match[1]}%`, `${match[1]}%`]) {
      const { data, error } = await supabase.from('bookings').select('*').ilike('paystack_reference', pattern).limit(2);
      if (error) throw new Error(`Booking lookup failed: ${error.message}`);
      if (data.length === 1) return data[0];
      if (data.length > 1) return null;
    }
    return null;
  }

  async function entriesToday(bookingId, today) {
    const { data, error } = await supabase
      .from('check_ins')
      .select('slot,created_at')
      .eq('booking_id', bookingId)
      .eq('check_in_date', today)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Check-in lookup failed: ${error.message}`);
    return data;
  }

  const passDetails = (booking, plan, entries, end) => ({
    holder: booking.full_name,
    plan_title: booking.plan_title,
    code: passCode(booking.paystack_reference),
    reference: booking.paystack_reference,
    valid_until: end,
    entries_today: entries.length,
    entries_allowed: plan?.entriesPerDay ?? 0,
    last_entry_at: entries[0]?.created_at ?? null,
  });

  // Every rule lives here, so a guard's phone can't talk the system into a yes.
  async function evaluate(found, today) {
    if (!found) return { deny: 'not_found' };
    const booking = await confirmIfPending(found);
    const plan = Object.hasOwn(PLANS, booking.plan_id ?? '') ? PLANS[booking.plan_id] : null;
    const start = booking.metadata?.booking_date || booking.start_time?.slice(0, 10);
    const end = booking.metadata?.valid_until || (plan && start ? validUntil(start, booking.plan_id) : null);
    const entries = plan ? await entriesToday(booking.id, today) : [];
    const details = { ...passDetails(booking, plan, entries, end), starts_on: start ?? null };

    if (booking.status !== 'paid') return { deny: 'not_paid', details };
    if (!plan || !start || !end) return { deny: 'invalid_plan', details };
    if (today < start) return { deny: 'not_started', details };
    if (today > end) return { deny: 'expired', details };
    if (entries.length >= plan.entriesPerDay) return { deny: 'used', details };
    return { booking, plan, end, entries, details };
  }

  // The unique index makes this safe when two phones scan the same pass at once.
  async function recordEntry(booking, plan, today) {
    for (let attempt = 0; attempt <= plan.entriesPerDay; attempt++) {
      const entries = await entriesToday(booking.id, today);
      if (entries.length >= plan.entriesPerDay) return { used: true, entries };
      const { error } = await supabase
        .from('check_ins')
        .insert([{ booking_id: booking.id, check_in_date: today, slot: entries.length + 1 }]);
      if (!error) return { entries: await entriesToday(booking.id, today) };
      if (error.code !== UNIQUE_VIOLATION) throw new Error(`Check-in failed: ${error.message}`);
    }
    return { used: true, entries: await entriesToday(booking.id, today) };
  }

  async function storedPhoto(bookingId) {
    const { data, error } = await supabase.from('pass_photos').select('image').eq('booking_id', bookingId).maybeSingle();
    if (error) throw new Error(`Photo lookup failed: ${error.message}`);
    return data?.image ?? null;
  }

  // Photos are only for checking the holder, so they go once the pass ends.
  async function deleteExpiredPhotos(today) {
    const { error } = await supabase.from('pass_photos').delete().lt('expires_on', today);
    if (error) console.error('[DOOR] Photo cleanup failed', error.message);
  }

  async function letIn(result, today, res) {
    const entry = await recordEntry(result.booking, result.plan, today);
    const details = passDetails(result.booking, result.plan, entry.entries, result.end);
    if (entry.used) return res.json({ verdict: 'deny', reason: 'used', ...details });
    return res.json({ verdict: 'enter', ...details });
  }

  const guarded = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[DOOR] Failed', err.message);
      res.status(500).json({ error: 'server_error' });
    }
  };

  router.post('/login', limiter(10), (req, res) => {
    if (!pinConfigured) return res.status(503).json({ error: 'The door scanner is not set up yet.' });
    if (typeof req.body?.pin !== 'string' || !safeEqual(req.body.pin, staffPin)) {
      return res.status(401).json({ error: 'Wrong PIN.' });
    }
    const expires = String(Date.now() + TOKEN_LIFETIME_MS);
    return res.json({ token: `${expires}.${sign(expires)}` });
  });

  router.post('/scan', limiter(300), requireStaff, guarded(async (req, res) => {
    const today = lagosDate();
    const result = await evaluate(await findBooking(req.body ?? {}), today);
    if (result.deny) return res.json({ verdict: 'deny', reason: result.deny, ...result.details });

    if (result.plan.photo) {
      const photo = await storedPhoto(result.booking.id);
      return res.json({ verdict: photo ? 'confirm_photo' : 'take_photo', photo, ...result.details });
    }
    return letIn(result, today, res);
  }));

  // Second step for photo passes, once the guard has taken or compared the photo.
  router.post('/check-in', limiter(300), requireStaff, guarded(async (req, res) => {
    const today = lagosDate();
    const result = await evaluate(await findBooking({ reference: req.body?.reference }), today);
    if (result.deny) return res.json({ verdict: 'deny', reason: result.deny, ...result.details });

    if (result.plan.photo && !(await storedPhoto(result.booking.id))) {
      const { photo } = req.body;
      if (typeof photo !== 'string' || photo.length > MAX_PHOTO_LENGTH || !PHOTO_RE.test(photo)) {
        return res.status(400).json({ error: 'photo_required' });
      }
      const { error } = await supabase
        .from('pass_photos')
        .upsert([{ booking_id: result.booking.id, image: photo, expires_on: result.end }]);
      if (error) throw new Error(`Photo save failed: ${error.message}`);
    }
    await deleteExpiredPhotos(today);
    return letIn(result, today, res);
  }));

  router.get('/entries', limiter(300), requireStaff, guarded(async (req, res) => {
    const { data: entries, error } = await supabase
      .from('check_ins')
      .select('booking_id,slot,created_at')
      .eq('check_in_date', lagosDate())
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Entries lookup failed: ${error.message}`);

    const ids = [...new Set(entries.map((e) => e.booking_id))];
    const { data: bookings, error: bookingsError } = ids.length
      ? await supabase.from('bookings').select('id,full_name,plan_title').in('id', ids)
      : { data: [], error: null };
    if (bookingsError) throw new Error(`Entries lookup failed: ${bookingsError.message}`);

    const byId = new Map(bookings.map((b) => [b.id, b]));
    return res.json({
      entries: entries.map((e) => ({
        at: e.created_at,
        holder: byId.get(e.booking_id)?.full_name ?? 'Unknown',
        plan_title: byId.get(e.booking_id)?.plan_title ?? '',
      })),
    });
  }));

  const paymentRow = (booking) => ({
    reference: booking.paystack_reference,
    code: passCode(booking.paystack_reference),
    holder: booking.full_name,
    email: booking.email,
    plan_id: booking.plan_id,
    plan_title: booking.plan_title,
    amount: booking.amount,
    starts_on: booking.metadata?.booking_date ?? null,
    notes: booking.metadata?.notes ?? '',
    booked_at: booking.created_at,
    status: booking.status,
  });

  const PAYMENT_COLUMNS = 'full_name,email,plan_id,plan_title,amount,paystack_reference,metadata,created_at,status';

  router.get('/payments', limiter(300), requireStaff, guarded(async (req, res) => {
    const since = new Date(Date.now() - WAITING_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const [waiting, confirmed] = await Promise.all([
      supabase
        .from('bookings')
        .select(PAYMENT_COLUMNS)
        .eq('status', 'pending')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('bookings')
        .select(PAYMENT_COLUMNS)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (waiting.error || confirmed.error) {
      throw new Error(`Payments lookup failed: ${(waiting.error || confirmed.error).message}`);
    }
    return res.json({ waiting: waiting.data.map(paymentRow), confirmed: confirmed.data.map(paymentRow) });
  }));

  // Releases a pass after a person has seen the transfer in the bank account.
  router.post('/confirm-payment', limiter(300), requireStaff, guarded(async (req, res) => {
    const booking = await findBooking({ reference: req.body?.reference });
    if (!booking) return res.status(404).json({ error: 'not_found' });
    if (booking.status === 'paid') return res.json({ already_paid: true, email_sent: false, booking: paymentRow(booking) });
    if (booking.status !== 'pending') return res.status(409).json({ error: 'not_pending' });

    const result = await markPaid(booking, {
      ...booking.metadata,
      payment_method: 'transfer',
      payment_confirmed_at: new Date().toISOString(),
    });
    return res.json({ already_paid: result.alreadyPaid, email_sent: result.emailSent, booking: paymentRow(result.booking) });
  }));

  router.get('/events', limiter(300), requireStaff, guarded(async (req, res) => {
    const { data: events, error } = await supabase.from('events').select('*').order('starts_at', { ascending: false }).limit(100);
    if (error) throw new Error(`Events lookup failed: ${error.message}`);
    const ids = events.map((e) => e.id);
    const { data: guests, error: guestsError } = ids.length
      ? await supabase.from('event_registrations').select('event_id').in('event_id', ids)
      : { data: [], error: null };
    if (guestsError) throw new Error(`Guests lookup failed: ${guestsError.message}`);
    const counts = new Map();
    for (const g of guests) counts.set(g.event_id, (counts.get(g.event_id) ?? 0) + 1);
    return res.json({
      events: events.map((e) => ({ ...publicEvent(e), id: e.id, organiser_email: e.organiser_email, guests: counts.get(e.id) ?? 0 })),
    });
  }));

  router.get('/events/:id/guests', limiter(300), requireStaff, guarded(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
    const { data, error } = await supabase
      .from('event_registrations')
      .select('full_name,email,created_at')
      .eq('event_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Guests lookup failed: ${error.message}`);
    return res.json({ guests: data.map((g) => ({ name: g.full_name, email: g.email, registered_at: g.created_at })) });
  }));

  return router;
}
