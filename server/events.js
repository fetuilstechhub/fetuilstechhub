// Event pages: organisers of a paid Event Hall booking set up a page, share its link,
// and guests register with their name and email to get an event pass by email.
import crypto from 'crypto';
import { Router } from 'express';
import { escapeHtml, guestPassEmailHtml } from './pass-email.js';

const REFERENCE_RE = /^[\w.=-]{1,100}$/;
const SLUG_RE = /^[a-z0-9-]{3,80}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIQUE_VIOLATION = '23505';
// Late guests can still register for a while after the event starts.
export const REGISTRATION_CLOSES_AFTER_MS = 2 * 60 * 60 * 1000;
export const EVENT_PLAN = 'event_hall';

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const oneLine = (value) => value.replace(/\s+/g, ' ');

// Lagos is UTC+1 all year, with no daylight saving.
export const eventStartsAt = (date, time) => new Date(`${date}T${time}:00+01:00`).toISOString();
const isOpen = (event) => Date.now() < Date.parse(event.starts_at) + REGISTRATION_CLOSES_AFTER_MS;

const slugify = (title) =>
  title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'event';

// Checks an organiser's or admin's event details. Returns the clean values or an error message.
// allowPast lets staff fix details of an event that has already happened.
export function eventDetails(body, date, { allowPast = false } = {}) {
  const title = oneLine(text(body.title, 120));
  const description = text(body.description, 2000);
  const startTime = text(body.start_time, 5);
  if (title.length < 3) return { error: 'Please give the event a name.' };
  if (!TIME_RE.test(startTime)) return { error: 'Please choose a start time.' };
  if (!date) return { error: 'This booking has no event date. Please contact the hub.' };
  const startsAt = eventStartsAt(date, startTime);
  if (!allowPast && Date.now() >= Date.parse(startsAt) + REGISTRATION_CLOSES_AFTER_MS) return { error: 'This event time has already passed.' };
  return { title, description, startsAt };
}

// Creates the event page for a booking with a unique link. Returns null if the
// booking already has one, for example when two saves happen at once.
export async function insertEvent(supabase, booking, { title, description, startsAt }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = `${slugify(title)}-${crypto.randomBytes(2).toString('hex')}`;
    const { data, error } = await supabase
      .from('events')
      .insert([{
        booking_id: booking.id,
        slug,
        title,
        description,
        starts_at: startsAt,
        organiser_name: booking.full_name,
        organiser_email: booking.email,
      }])
      .select()
      .single();
    if (!error) return data;
    if (error.code !== UNIQUE_VIOLATION) throw new Error(`Event insert failed: ${error.message}`);
    const { data: existing, error: lookupError } = await supabase.from('events').select('id').eq('booking_id', booking.id).maybeSingle();
    if (lookupError) throw new Error(`Event lookup failed: ${lookupError.message}`);
    if (existing) return null;
  }
  throw new Error('Could not create a unique event link');
}

export const publicEvent = (event) => ({
  slug: event.slug,
  title: event.title,
  description: event.description,
  starts_at: event.starts_at,
  organiser: event.organiser_name,
  open: isOpen(event),
});

export function eventsRouter({ supabase, limiter, sendEmail, frontendUrl }) {
  const router = Router();

  const guarded = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[EVENTS] Failed', err.message);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };

  // The booking reference is the organiser's private key, the same one their pass uses.
  async function organiserBooking(reference) {
    if (typeof reference !== 'string' || !REFERENCE_RE.test(reference)) return { error: [404, 'We could not find this booking.'] };
    const { data: booking, error } = await supabase.from('bookings').select('*').eq('paystack_reference', reference).maybeSingle();
    if (error) throw new Error(`Booking lookup failed: ${error.message}`);
    if (!booking) return { error: [404, 'We could not find this booking.'] };
    if (booking.plan_id !== EVENT_PLAN) return { error: [403, 'This booking is not an Event Hall booking.'] };
    if (booking.status !== 'paid') return { error: [403, 'Your payment has not been confirmed yet.'] };
    const date = booking.metadata?.booking_date || booking.start_time?.slice(0, 10);
    const { data: event, error: eventError } = await supabase.from('events').select('*').eq('booking_id', booking.id).maybeSingle();
    if (eventError) throw new Error(`Event lookup failed: ${eventError.message}`);
    return { booking, date, event };
  }

  async function findEvent(slug) {
    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return null;
    const { data, error } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle();
    if (error) throw new Error(`Event lookup failed: ${error.message}`);
    return data;
  }

  router.get('/setup', limiter(120), guarded(async (req, res) => {
    const found = await organiserBooking(req.query.reference);
    if (found.error) return res.status(found.error[0]).json({ error: found.error[1] });
    return res.json({
      organiser: found.booking.full_name,
      date: found.date,
      event: found.event ? { ...publicEvent(found.event), start_time: null } : null,
    });
  }));

  router.post('/setup', limiter(30), guarded(async (req, res) => {
    const body = req.body || {};
    const found = await organiserBooking(body.reference);
    if (found.error) return res.status(found.error[0]).json({ error: found.error[1] });

    const details = eventDetails(body, found.date);
    if (details.error) return res.status(400).json({ error: details.error });
    const { title, description, startsAt } = details;

    if (found.event) {
      const { data, error } = await supabase
        .from('events')
        .update({ title, description, starts_at: startsAt })
        .eq('id', found.event.id)
        .select()
        .single();
      if (error) throw new Error(`Event update failed: ${error.message}`);
      return res.json(publicEvent(data));
    }

    const created = await insertEvent(supabase, found.booking, details);
    if (created) return res.json(publicEvent(created));
    // Two saves at once for the same booking: return the one that won.
    const again = await organiserBooking(body.reference);
    return res.json(publicEvent(again.event));
  }));

  // Link previews. The website sends WhatsApp, Facebook and similar bots here for
  // /events/<slug>, so a shared link shows the event's name and date. People never see it.
  router.get('/:slug/preview', limiter(600), guarded(async (req, res) => {
    const event = await findEvent(req.params.slug);
    const url = `${frontendUrl}/events/${encodeURIComponent(req.params.slug)}`;
    const image = `${frontendUrl}/og-event.png`;
    let title = 'Event at FETUILS TechHub';
    let description = 'Register for events at FETUILS TechHub, NLNG, UNILORIN.';
    if (event) {
      const when = new Date(event.starts_at);
      const date = when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });
      const time = when.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
      title = `${event.title} · FETUILS TechHub`;
      description = isOpen(event)
        ? `${date}, ${time} at FETUILS TechHub, NLNG, UNILORIN. Register with your name and email to get your event pass.`
        : `${date}, ${time} at FETUILS TechHub, NLNG, UNILORIN. Registration has closed.`;
    }
    const t = escapeHtml(title);
    const d = escapeHtml(description);
    res.set('Cache-Control', event ? 'public, max-age=300' : 'no-store');
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FETUILS TechHub">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="FETUILS TechHub event invitation">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="canonical" href="${escapeHtml(url)}">
</head><body><h1>${t}</h1><p>${d}</p><p><a href="${escapeHtml(url)}">Open the event page</a></p></body></html>`);
  }));

  router.get('/:slug', limiter(600), guarded(async (req, res) => {
    const event = await findEvent(req.params.slug);
    if (!event) return res.status(404).json({ error: 'not_found' });
    return res.json(publicEvent(event));
  }));

  router.post('/:slug/register', limiter(100), guarded(async (req, res) => {
    const body = req.body || {};
    // Hidden form field that only bots fill in. Pretend success so they move on.
    if (body.website) return res.json({ ok: true, email_sent: true });

    const event = await findEvent(req.params.slug);
    if (!event) return res.status(404).json({ error: 'We could not find this event.' });
    if (!isOpen(event)) return res.status(410).json({ error: 'Registration for this event has closed.' });

    const fullName = oneLine(text(body.full_name, 120));
    const email = text(body.email, 254).toLowerCase();
    if (!fullName) return res.status(400).json({ error: 'Please enter your full name.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    const { error } = await supabase.from('event_registrations').insert([{ event_id: event.id, full_name: fullName, email }]).select();
    if (error?.code === UNIQUE_VIOLATION) return res.json({ ok: true, already_registered: true });
    if (error) throw new Error(`Registration failed: ${error.message}`);

    try {
      await sendEmail({
        to: email,
        subject: `You're registered: ${event.title}`,
        html: guestPassEmailHtml({ event, guestName: fullName, frontendUrl }),
      });
      return res.json({ ok: true, email_sent: true });
    } catch (err) {
      console.error('[EVENTS] Guest email failed for event', event.id, err.message);
      return res.json({ ok: true, email_sent: false });
    }
  }));

  return router;
}
