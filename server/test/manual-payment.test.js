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

const state = emptyState();
const fake = createFakeServices(state, FAKE_PORT);
let server;
let token;

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const valid = { full_name: 'Ada Obi', email: 'ada@example.com', booking_date: today, plan_id: 'daily' };

const post = (route, body, auth) =>
  fetch(`${API}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body),
  });
const book = async (body = valid) => (await post('/api/create-transaction', body)).json();
const confirm = (reference, auth = token) => post('/api/door/confirm-payment', { reference }, auth);
const payments = async () =>
  (await fetch(`${API}/api/door/payments`, { headers: { Authorization: `Bearer ${token}` } })).json();

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
  assert.equal((await fetch(`${API}/api/door/events`)).status, 401);
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const { events } = await (await fetch(`${API}/api/door/events`, auth)).json();
  assert.equal(events.length, 1);
  assert.equal(events[0].guests, 2);
  assert.equal(events[0].organiser_email, 'tola@example.com');
  assert.equal((await fetch(`${API}/api/door/events/${events[0].id}/guests`)).status, 401);
  const { guests } = await (await fetch(`${API}/api/door/events/${events[0].id}/guests`, auth)).json();
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
  assert.equal((await fetch(`${API}/api/door/payments`)).status, 401);
  assert.equal((await confirm(reference, 'abc.def')).status, 401);
  assert.equal((await post('/api/door/confirm-payment', { reference })).status, 401);
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

  const { waiting, confirmed } = await payments();
  assert.deepEqual(waiting.map((p) => p.reference), [second.reference]);
  assert.equal(waiting[0].notes, 'Arriving at noon');
  assert.equal(waiting[0].amount, 1500);
  assert.deepEqual(confirmed.map((p) => p.reference), [first.reference]);
  assert.ok(!JSON.stringify(waiting).includes(old.reference));
  assert.equal(waiting[0].id, undefined);
});
