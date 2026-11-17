// Bank transfer mode: Paystack stays off and staff release passes by hand.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createFakeServices, emptyState } from './fake-services.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18807;
const FAKE_PORT = 18808;
const API = `http://127.0.0.1:${PORT}`;
const PIN = '482913';
const ADMIN_PIN = '73915508';

const state = emptyState();
const fake = createFakeServices(state, FAKE_PORT);
let server;
let token;
let adminToken;

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const valid = { full_name: 'Ada Obi', email: 'ada@example.com', booking_date: today, plan_id: 'daily' };

const post = (route, body, auth) =>
  fetch(`${API}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body),
  });
const book = async (body = valid) => (await post('/api/create-transaction', body)).json();
const confirm = (reference, auth = adminToken) => post('/api/admin/confirm-payment', { reference }, auth);
const payments = async () =>
  (await fetch(`${API}/api/admin/payments`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
const paidBookings = async () =>
  (await fetch(`${API}/api/admin/bookings?status=paid`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();

before(async () => {
  await new Promise((resolve) => fake.listen(FAKE_PORT, resolve));
  const base = `http://127.0.0.1:${FAKE_PORT}`;
  const env = { ...process.env };
  delete env.PAYMENT_MODE;
  delete env.PAYSTACK_SECRET_KEY;
  server = spawn(process.execPath, [path.join(here, '..', 'index.js')], {
    // Run from an empty folder so the real server/.env can never be loaded.
    cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'fet-manual-')),
    env: {
      ...env,
      PORT: String(PORT),
      SUPABASE_URL: base,
      SUPABASE_SERVICE_ROLE_KEY: 'service_key',
      PAYSTACK_API_BASE: base,
      RESEND_API_KEY: 'resend_key',
      RESEND_API_BASE: base,
      RESEND_FROM_EMAIL: 'test@fetuils.ng',
      FRONTEND_URL: 'https://fetuils.ng',
      STAFF_PIN: PIN,
      ADMIN_PIN,
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(`${API}/api/health`)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  token = (await (await post('/api/door/login', { pin: PIN })).json()).token;
  assert.ok(token);
  adminToken = (await (await post('/api/admin/login', { pin: ADMIN_PIN })).json()).token;
  assert.ok(adminToken);
});

after(() => {
  server.kill();
  fake.close();
  fake.closeAllConnections();
});

beforeEach(() => {
  Object.assign(state, emptyState());
});

test('a booking is saved as pending and never touches Paystack', async () => {
  const body = await book({ ...valid, amount: 1, plan_title: 'Hacked' });
  assert.equal(body.authorization_url, undefined);
  assert.equal(state.paystackInits.length, 0);
  assert.equal(state.bookings[0].status, 'pending');
  assert.equal(state.bookings[0].amount, 1500);
  assert.equal(state.emails.length, 0);
});

test('the WhatsApp message carries the server price, plan and booking code', async () => {
  const { reference, whatsapp_message: message } = await book({ ...valid, full_name: 'Ada\nObi', amount: 1 });
  for (const expected of ['Name: Ada Obi', 'Email: ada@example.com', '₦1,500', `FET-${reference.slice(4, 12).toUpperCase()}`]) {
    assert.ok(message.includes(expected), expected);
  }
  assert.ok(message.includes(state.bookings[0].plan_title));
});

test('an event hall booking costs 50,000 for one day', async () => {
  const { whatsapp_message: message } = await book({ ...valid, plan_id: 'event_hall' });
  assert.ok(message.includes('Plan: Event Hall'));
  assert.ok(message.includes('₦50,000'));
  assert.equal(state.bookings[0].amount, 50000);
  assert.equal(state.bookings[0].metadata.valid_until, today);
});

async function paidEvent() {
  const { reference } = await book({ ...valid, plan_id: 'event_hall', full_name: 'Tola Host', email: 'tola@example.com' });
  await confirm(reference);
  return reference;
}
const setupEvent = (body) => post('/api/events/setup', body);
const register = (slug, body) => post(`/api/events/${slug}/register`, body);
const later = () => {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Lagos' });
  return d < '21:00' ? d : '23:59';
};

test('the Event Hall pass email links the organiser to their event setup', async () => {
  const reference = await paidEvent();
  assert.ok(state.emails[0].html.includes(`/events/setup?reference=${reference}`));
  const { reference: daily } = await book();
  await confirm(daily);
  assert.ok(!state.emails[1].html.includes('/events/setup'));
});

test('only a paid Event Hall booking can set up an event', async () => {
  const { reference: unpaid } = await book({ ...valid, plan_id: 'event_hall' });
  assert.equal((await setupEvent({ reference: unpaid, title: 'Summit', start_time: '10:00' })).status, 403);
  const { reference: daily } = await book();
  await confirm(daily);
  assert.equal((await setupEvent({ reference: daily, title: 'Summit', start_time: '10:00' })).status, 403);
  assert.equal((await setupEvent({ reference: 'fet_nope', title: 'Summit', start_time: '10:00' })).status, 404);
  assert.equal(state.events.length, 0);
});

test('an organiser creates and edits their event page, keeping the link', async () => {
  const reference = await paidEvent();
  assert.equal((await setupEvent({ reference, title: 'x', start_time: '10:00' })).status, 400);
  assert.equal((await setupEvent({ reference, title: 'Summit', start_time: '25:00' })).status, 400);
  const created = await (await setupEvent({ reference, title: 'Tech Summit 2026!', description: 'Talks', start_time: later() })).json();
  assert.match(created.slug, /^tech-summit-2026-[0-9a-f]{4}$/);
  assert.equal(created.open, true);
  const edited = await (await setupEvent({ reference, title: 'Tech Summit', start_time: later() })).json();
  assert.equal(edited.slug, created.slug);
  assert.equal(state.events.length, 1);
  const page = await (await fetch(`${API}/api/events/${created.slug}`)).json();
  assert.equal(page.title, 'Tech Summit');
  assert.equal(page.organiser, 'Tola Host');
  assert.equal(page.id, undefined);
  assert.equal(page.organiser_email, undefined);
  const setup = await (await fetch(`${API}/api/events/setup?reference=${reference}`)).json();
  assert.equal(setup.event.slug, created.slug);
});

test('guests register with name and email and get an event pass by email', async () => {
  const reference = await paidEvent();
  const { slug } = await (await setupEvent({ reference, title: 'Tech Summit', start_time: later() })).json();
  const before = state.emails.length;
  const res = await register(slug, { full_name: '<b>Ngozi</b>', email: 'Ngozi@Example.com' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).email_sent, true);
  const mail = state.emails[before];
  assert.equal(mail.to, 'ngozi@example.com');
  assert.match(mail.subject, /Tech Summit/);
  assert.ok(mail.html.includes('&lt;b&gt;Ngozi'));
  assert.ok(mail.html.includes('Event Pass'));
  assert.ok(mail.html.includes('NLNG, UNILORIN'));

  const again = await (await register(slug, { full_name: 'Ngozi', email: 'ngozi@example.com' })).json();
  assert.equal(again.already_registered, true);
  assert.equal(state.emails.length, before + 1);
  assert.equal(state.event_registrations.length, 1);

  assert.equal((await register(slug, { full_name: 'A', email: 'bad' })).status, 400);
  assert.equal((await register(slug, { full_name: ' ', email: 'a@b.co' })).status, 400);
  assert.equal((await register(slug, { full_name: 'Bot', email: 'bot@b.co', website: 'x' })).status, 200);
  assert.equal((await register('no-such-event', { full_name: 'A', email: 'a@b.co' })).status, 404);
  assert.equal(state.event_registrations.length, 1);
});

test('registration closes 2 hours after the event starts', async () => {
  const reference = await paidEvent();
  const { slug } = await (await setupEvent({ reference, title: 'Tech Summit', start_time: later() })).json();
  state.events[0].starts_at = new Date(Date.now() - 119 * 60 * 1000).toISOString();
  assert.equal((await register(slug, { full_name: 'Late', email: 'late@example.com' })).status, 200);
  state.events[0].starts_at = new Date(Date.now() - 121 * 60 * 1000).toISOString();
  assert.equal((await register(slug, { full_name: 'Too late', email: 'toolate@example.com' })).status, 410);
  assert.equal((await (await fetch(`${API}/api/events/${slug}`)).json()).open, false);
});

test('staff see every event with its guest count and guest list', async () => {
  const reference = await paidEvent();
  const { slug } = await (await setupEvent({ reference, title: 'Tech Summit', start_time: later() })).json();
  await register(slug, { full_name: 'Ngozi', email: 'ngozi@example.com' });
  await register(slug, { full_name: 'Musa', email: 'musa@example.com' });
  assert.equal((await fetch(`${API}/api/admin/events`)).status, 401);
  assert.equal((await fetch(`${API}/api/admin/events`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  const auth = { headers: { Authorization: `Bearer ${adminToken}` } };
  const { events } = await (await fetch(`${API}/api/admin/events`, auth)).json();
  assert.equal(events.length, 1);
  assert.equal(events[0].guests, 2);
  assert.equal(events[0].organiser_email, 'tola@example.com');
  assert.equal((await fetch(`${API}/api/admin/events/${events[0].id}/guests`)).status, 401);
  const { guests } = await (await fetch(`${API}/api/admin/events/${events[0].id}/guests`, auth)).json();
  assert.deepEqual(guests.map((g) => g.name), ['Ngozi', 'Musa']);
});

test('Paystack cannot release a pass in this mode', async () => {
  const { reference } = await book();
  state.verify = { status: 'success', amount: 150000, currency: 'NGN' };
  const status = await (await fetch(`${API}/api/booking-status?reference=${reference}`)).json();
  assert.equal(status.status, 'pending');

  const raw = JSON.stringify({ event: 'charge.success', data: { reference, amount: 150000, currency: 'NGN' } });
  const signature = crypto.createHmac('sha512', '').update(raw).digest('hex');
  const hook = await fetch(`${API}/api/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
    body: raw,
  });
  assert.equal(hook.status, 200);
  assert.equal(state.bookings[0].status, 'pending');
  assert.equal(state.emails.length, 0);
});

test('payment screens need a staff sign-in', async () => {
  const { reference } = await book();
  assert.equal((await fetch(`${API}/api/admin/payments`)).status, 401);
  assert.equal((await fetch(`${API}/api/admin/payments`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await confirm(reference, token)).status, 401);
  assert.equal((await confirm(reference, 'abc.def')).status, 401);
  assert.equal((await post('/api/admin/confirm-payment', { reference })).status, 401);
  assert.equal((await post('/api/door/confirm-payment', { reference }, token)).status, 404);
  assert.equal(state.bookings[0].status, 'pending');
});

test('an unpaid booking is refused at the door, then let in once staff confirm it', async () => {
  const { reference } = await book();
  const scan = async () => (await post('/api/door/scan', { reference }, token)).json();
  const first = await scan();
  assert.equal(first.verdict, 'deny');
  assert.equal(first.reason, 'not_paid');

  const res = await confirm(reference);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.email_sent, true);
  assert.equal(body.already_paid, false);
  assert.equal(state.bookings[0].status, 'paid');
  assert.equal(state.bookings[0].metadata.payment_method, 'transfer');
  assert.equal(state.bookings[0].metadata.booking_date, today);
  assert.ok(state.bookings[0].metadata.payment_confirmed_at);
  assert.equal(state.emails.length, 1);
  assert.equal(state.emails[0].to, 'ada@example.com');
  assert.ok(state.emails[0].html.includes(`reference=${reference}`));

  assert.equal((await scan()).verdict, 'enter');
});

test('tapping Payment received twice sends one email', async () => {
  const { reference } = await book();
  await confirm(reference);
  const second = await (await confirm(reference)).json();
  assert.equal(second.already_paid, true);
  assert.equal(state.emails.length, 1);
});

test('two phones confirming at once send one email', async () => {
  const { reference } = await book();
  await Promise.all([confirm(reference), confirm(reference)]);
  assert.equal(state.bookings[0].status, 'paid');
  assert.equal(state.emails.length, 1);
});

test('a failed email is reported to staff and the booking stays paid', async () => {
  const { reference } = await book();
  state.failEmail = true;
  const body = await (await confirm(reference)).json();
  assert.equal(body.email_sent, false);
  assert.equal(body.already_paid, false);
  assert.equal(state.bookings[0].status, 'paid');
});

test('unknown and failed bookings cannot be confirmed', async () => {
  assert.equal((await confirm('fet_unknown')).status, 404);
  assert.equal((await confirm({ not: 'a string' })).status, 404);
  const { reference } = await book();
  state.bookings[0].status = 'failed';
  assert.equal((await confirm(reference)).status, 409);
  assert.equal(state.bookings[0].status, 'failed');
  assert.equal(state.emails.length, 0);
});

test('the list shows recent waiting bookings and confirmed ones', async () => {
  const first = await book();
  const second = await book({ ...valid, full_name: 'Bola Ade', notes: 'Arriving at noon' });
  const old = await book({ ...valid, full_name: 'Old Booking' });
  state.bookings[2].created_at = new Date(Date.now() - 15 * 86_400_000).toISOString();
  await confirm(first.reference);

  const { waiting } = await payments();
  const { bookings: confirmed } = await paidBookings();
  assert.deepEqual(waiting.map((p) => p.reference), [second.reference]);
  assert.equal(waiting[0].notes, 'Arriving at noon');
  assert.equal(waiting[0].amount, 1500);
  assert.deepEqual(confirmed.map((p) => p.reference), [first.reference]);
  assert.ok(!JSON.stringify(waiting).includes(old.reference));
  assert.equal(waiting[0].id, undefined);
});

// ---------------- Admin ----------------
const adminGet = async (route) =>
  (await fetch(`${API}/api/admin/${route}`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
const adminPost = (route, body) => post(`/api/admin/${route}`, body, adminToken);

test('the admin needs its own PIN: the door PIN never opens it', async () => {
  assert.equal((await post('/api/admin/login', { pin: PIN })).status, 401);
  assert.equal((await post('/api/admin/login', { pin: 'nope' })).status, 401);
  for (const route of ['overview', 'payments', 'bookings', 'check-ins', 'events']) {
    assert.equal((await fetch(`${API}/api/admin/${route}`)).status, 401, route);
    assert.equal((await fetch(`${API}/api/admin/${route}`, { headers: { Authorization: `Bearer ${token}` } })).status, 401, route);
  }
  // The admin token does not open the door scanner either.
  assert.equal((await post('/api/door/scan', { reference: 'fet_x' }, adminToken)).status, 401);
});

test('staff add an event for an organiser who already paid, in one step', async () => {
  const res = await adminPost('events', {
    organiser_name: 'Tola Host', organiser_email: 'Tola@Example.com', date: today,
    title: 'Builders Meetup', start_time: later(), description: 'Talks',
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.event.slug, /^builders-meetup-[0-9a-f]{4}$/);
  assert.equal(body.email_sent, true);
  assert.equal(state.bookings[0].status, 'paid');
  assert.equal(state.bookings[0].plan_id, 'event_hall');
  assert.equal(state.bookings[0].amount, 50000);
  assert.equal(state.bookings[0].email, 'tola@example.com');
  assert.equal(state.emails[0].to, 'tola@example.com');
  assert.ok(state.emails[0].html.includes('/events/setup?reference='));
  const page = await (await fetch(`${API}/api/events/${body.event.slug}`)).json();
  assert.equal(page.title, 'Builders Meetup');
  assert.equal((await register(body.event.slug, { full_name: 'Ngozi', email: 'ngozi@example.com' })).status, 200);

  assert.equal((await adminPost('events', { organiser_name: 'A', organiser_email: 'bad', date: today, title: 'X Event', start_time: '10:00' })).status, 400);
  assert.equal((await adminPost('events', { organiser_name: 'A', organiser_email: 'a@b.co', date: today, title: 'X', start_time: '10:00' })).status, 400);
});

test('staff add bookings by hand, with or without payment, and can set the amount', async () => {
  const unpaid = await (await adminPost('bookings', { plan_id: 'daily', full_name: 'Walk In', email: 'walk@example.com', date: today })).json();
  assert.equal(unpaid.booking.status, 'pending');
  assert.equal(state.emails.length, 0);
  const paid = await (await adminPost('bookings', { plan_id: 'weekly', full_name: 'FET Student', email: 'fet@example.com', date: today, amount: 5850, paid: true })).json();
  assert.equal(paid.booking.status, 'paid');
  assert.equal(paid.booking.amount, 5850);
  assert.equal(paid.email_sent, true);
  assert.equal(state.emails.length, 1);
  assert.equal((await adminPost('bookings', { plan_id: 'free', full_name: 'X', email: 'x@y.co', date: today })).status, 400);
  assert.equal((await adminPost('bookings', { plan_id: 'daily', full_name: 'X', email: 'x@y.co', date: today, amount: -5 })).status, 400);
});

test('staff resend a pass and cancel unpaid bookings only', async () => {
  const { reference: unpaid } = await book();
  const { reference: done } = await book({ ...valid, full_name: 'Paid Person' });
  await confirm(done);
  const before = state.emails.length;
  assert.equal((await (await adminPost('bookings/resend', { reference: done })).json()).email_sent, true);
  assert.equal(state.emails.length, before + 1);
  assert.equal((await adminPost('bookings/resend', { reference: unpaid })).status, 409);
  assert.equal((await adminPost('bookings/cancel', { reference: done })).status, 409);
  assert.equal((await adminPost('bookings/cancel', { reference: unpaid })).status, 200);
  assert.equal(state.bookings.find((b) => b.paystack_reference === unpaid).status, 'cancelled');
  const { waiting } = await payments();
  assert.equal(waiting.length, 0);
  const scan = await (await post('/api/door/scan', { reference: unpaid }, token)).json();
  assert.equal(scan.verdict, 'deny');
});

test('the overview adds up money received, waiting payments, check-ins and events', async () => {
  const { reference: a } = await book();
  const { reference: b } = await book({ ...valid, plan_id: 'weekly' });
  await book({ ...valid, full_name: 'Still Waiting' });
  await confirm(a);
  await confirm(b);
  await post('/api/door/scan', { reference: a }, token);
  await adminPost('events', { organiser_name: 'Tola', organiser_email: 't@e.co', date: today, title: 'Summit Day', start_time: later() });

  const o = await adminGet('overview');
  assert.equal(o.revenue.today, 1500 + 6500 + 50000);
  assert.equal(o.revenue.month, 58000);
  assert.equal(o.revenue.month_payments, 3);
  assert.equal(o.waiting_payments, 1);
  assert.equal(o.check_ins_today, 1);
  assert.equal(o.active_passes, 3);
  assert.equal(o.daily.length, 14);
  assert.equal(o.daily[13].amount, 58000);
  assert.equal(o.upcoming_events.length, 1);
  assert.equal(o.by_plan[0].plan, 'Event Hall');

  const checks = await adminGet('check-ins');
  assert.equal(checks.entries.length, 1);
  assert.equal(checks.entries[0].holder, 'Ada Obi');
});

test('staff can take an event page down with its guest list', async () => {
  const { event } = await (await adminPost('events', { organiser_name: 'Tola', organiser_email: 't@e.co', date: today, title: 'Summit Day', start_time: later() })).json();
  await register(event.slug, { full_name: 'Ngozi', email: 'ngozi@example.com' });
  const res = await fetch(`${API}/api/admin/events/${event.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(res.status, 200);
  assert.equal(state.events.length, 0);
  assert.equal(state.event_registrations.length, 0);
  assert.equal((await fetch(`${API}/api/events/${event.slug}`)).status, 404);
  assert.equal(state.bookings[0].status, 'paid');
});

test('staff see every attendee across all events', async () => {
  const one = (await (await adminPost('events', { organiser_name: 'Tola', organiser_email: 't@e.co', date: today, title: 'Summit Day', start_time: later() })).json()).event;
  const two = (await (await adminPost('events', { organiser_name: 'Musa', organiser_email: 'm@e.co', date: today, title: 'Design Jam', start_time: later() })).json()).event;
  await register(one.slug, { full_name: 'Ngozi', email: 'ngozi@example.com' });
  await register(two.slug, { full_name: 'Ngozi', email: 'ngozi@example.com' });
  await register(two.slug, { full_name: 'Bayo', email: 'bayo@example.com' });
  assert.equal((await fetch(`${API}/api/admin/guests`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  const { guests } = await adminGet('guests');
  assert.equal(guests.length, 3);
  assert.deepEqual(guests.map((g) => g.event_title).sort(), ['Design Jam', 'Design Jam', 'Summit Day']);
});

test('an admin sign-in lasts 12 hours, a door sign-in lasts a week', () => {
  const hours = (tok) => (Number(tok.split('.')[0]) - Date.now()) / 3_600_000;
  assert.ok(hours(adminToken) > 11 && hours(adminToken) <= 12);
  assert.ok(hours(token) > 24 * 6);
});

test('staff can confirm an agreed amount and correct it later, keeping the listed price', async () => {
  const { reference } = await book({ ...valid, plan_id: 'event_hall' });
  assert.equal((await adminPost('confirm-payment', { reference, amount: 'lots' })).status, 400);
  assert.equal(state.bookings[0].status, 'pending');
  const res = await (await adminPost('confirm-payment', { reference, amount: 40000 })).json();
  assert.equal(res.booking.amount, 40000);
  assert.equal(res.booking.listed_price, 50000);
  assert.equal(state.bookings[0].amount, 40000);
  assert.ok(state.emails[0].html.includes('₦40,000'));

  const fixed = await (await adminPost('bookings/amount', { reference, amount: 45000 })).json();
  assert.equal(fixed.booking.amount, 45000);
  assert.deepEqual(state.bookings[0].metadata.amount_changes.map((c) => [c.from, c.to]), [[40000, 45000]]);
  assert.equal((await adminGet('overview')).revenue.today, 45000);

  const { reference: unpaid } = await book();
  assert.equal((await adminPost('bookings/amount', { reference: unpaid, amount: 1000 })).status, 409);
  assert.equal((await post('/api/admin/bookings/amount', { reference, amount: 1 }, token)).status, 401);
});

test('staff edit an event and its organiser, keeping the link and the booking in step', async () => {
  const { event } = await (await adminPost('events', { organiser_name: 'Tola', organiser_email: 't@e.co', date: today, title: 'Summit Day', start_time: later() })).json();
  const edit = (body) => fetch(`${API}/api/admin/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  const good = { organiser_name: 'Tola Adebayo', organiser_email: 'Tola.New@Example.com', title: 'Summit Day 2', date: tomorrow, start_time: '15:30', description: 'New details' };
  assert.equal((await edit({ ...good, organiser_email: 'bad' })).status, 400);
  assert.equal((await edit({ ...good, title: 'X' })).status, 400);
  const res = await edit(good);
  assert.equal(res.status, 200);
  const page = await (await fetch(`${API}/api/events/${event.slug}`)).json();
  assert.equal(page.title, 'Summit Day 2');
  assert.equal(page.organiser, 'Tola Adebayo');
  assert.equal(page.description, 'New details');
  assert.equal(state.events[0].organiser_email, 'tola.new@example.com');
  assert.equal(state.bookings[0].email, 'tola.new@example.com');
  assert.equal(state.bookings[0].full_name, 'Tola Adebayo');
  assert.equal(state.bookings[0].metadata.booking_date, tomorrow);
  const noAuth = await fetch(`${API}/api/admin/events/${event.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(good) });
  assert.equal(noAuth.status, 401);
});

test('staff can permanently delete a test booking with everything linked to it', async () => {
  const { event } = await (await adminPost('events', { organiser_name: 'Test', organiser_email: 'test@e.co', date: today, title: 'Test Event', start_time: later() })).json();
  await register(event.slug, { full_name: 'Guest', email: 'guest@example.com' });
  const { reference: keep } = await book({ ...valid, full_name: 'Keep Me' });
  const eventRef = state.bookings[0].paystack_reference;
  assert.equal((await post('/api/admin/bookings/delete', { reference: eventRef }, token)).status, 401);
  assert.equal((await adminPost('bookings/delete', { reference: eventRef })).status, 200);
  assert.deepEqual(state.bookings.map((b) => b.paystack_reference), [keep]);
  assert.equal(state.events.length, 0);
  assert.equal(state.event_registrations.length, 0);
  assert.equal((await adminPost('bookings/delete', { reference: eventRef })).status, 404);
});

test('event link previews show the event name, date and branded image, safely', async () => {
  const { event } = await (await adminPost('events', { organiser_name: 'Tola', organiser_email: 't@e.co', date: today, title: 'Biomedical <Expo> & "Summit"', start_time: later() })).json();
  const res = await fetch(`${API}/api/events/${event.slug}/preview`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.ok(html.includes('<meta property="og:title" content="Biomedical &lt;Expo&gt; &amp; &quot;Summit&quot; · FETUILS TechHub">'));
  assert.ok(html.includes('Register with your name and email'));
  assert.ok(html.includes('https://fetuils.ng/og-event.png'));
  assert.ok(html.includes(`https://fetuils.ng/events/${event.slug}`));
  assert.ok(!html.includes('<Expo>'));
  const missing = await (await fetch(`${API}/api/events/no-such-event/preview`)).text();
  assert.ok(missing.includes('Event at FETUILS TechHub'));
});

test('guest emails retry when Resend says slow down, and staff see and fix failures', async () => {
  const { event } = await (await adminPost('events', { organiser_name: 'Tola', organiser_email: 't@e.co', date: today, title: 'Summit Day', start_time: later() })).json();
  const before = state.emails.length;
  state.rateLimitEmails = 2;
  const ok = await (await register(event.slug, { full_name: 'Busy Moment', email: 'busy@example.com' })).json();
  assert.equal(ok.email_sent, true);
  assert.equal(state.emails.length, before + 1);

  state.failEmail = true;
  const bad = await (await register(event.slug, { full_name: 'Unlucky', email: 'unlucky@example.com' })).json();
  assert.equal(bad.email_sent, false);
  state.failEmail = false;

  let { guests } = await adminGet(`events/${event.id}/guests`);
  assert.deepEqual(guests.map((g) => [g.email, g.email_status]), [['busy@example.com', 'sent'], ['unlucky@example.com', 'failed']]);

  const again = await (await adminPost(`events/${event.id}/resend`, { failed: true })).json();
  assert.deepEqual(again, { sent: 1, failed: 0 });
  ({ guests } = await adminGet(`events/${event.id}/guests`));
  assert.equal(guests[1].email_status, 'sent');

  const one = await (await adminPost(`events/${event.id}/resend`, { email: 'BUSY@example.com' })).json();
  assert.equal(one.sent, 1);
  assert.equal((await adminPost(`events/${event.id}/resend`, { failed: true })).status, 404);
  assert.equal((await post(`/api/admin/events/${event.id}/resend`, { failed: true }, token)).status, 401);
});
