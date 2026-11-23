// Runs the real server against a local fake of Supabase, Paystack and Resend.
// No real service is contacted. Run with: npm test
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PLANS } from '../plans.js';
import { createFakeServices, emptyState } from './fake-services.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SECRET = 'test_secret';
const PORT = 18787;
const FAKE_PORT = 18788;
const API = `http://127.0.0.1:${PORT}`;

const state = emptyState();
const fake = createFakeServices(state, FAKE_PORT);

let server;

before(async () => {
  await new Promise((resolve) => fake.listen(FAKE_PORT, resolve));
  const base = `http://127.0.0.1:${FAKE_PORT}`;
  // Run from an empty folder so the real server/.env can never be loaded.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'fet-test-'));
  server = spawn(process.execPath, [path.join(here, '..', 'index.js')], {
    cwd,
    env: {
      ...process.env,
      PORT: String(PORT),
      PAYMENT_MODE: 'paystack',
      SUPABASE_URL: base,
      SUPABASE_SERVICE_ROLE_KEY: 'service_key',
      PAYSTACK_SECRET_KEY: SECRET,
      PAYSTACK_API_BASE: base,
      RESEND_API_KEY: 'resend_key',
      RESEND_API_BASE: base,
      RESEND_FROM_EMAIL: 'test@fetuils.ng',
      CONTACT_TO_EMAIL: 'inbox@fetuils.ng',
      FRONTEND_URL: 'https://fetuils.ng',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(`${API}/api/health`)).ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('server did not start');
});

after(() => {
  server.kill();
  fake.close();
  fake.closeAllConnections();
});

beforeEach(() => {
  Object.assign(state, emptyState());
});

const future = '2099-01-15';
const valid = { full_name: 'Ada Obi', email: 'ada@example.com', booking_date: future, plan_id: 'monthly' };

const post = (route, body, headers = {}) =>
  fetch(`${API}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const webhook = (event, secret = SECRET) => {
  const raw = JSON.stringify(event);
  const signature = crypto.createHmac('sha512', secret).update(raw).digest('hex');
  return post('/api/webhook', raw, { 'x-paystack-signature': signature });
};

const charge = (reference, amount, currency = 'NGN') => ({
  event: 'charge.success',
  data: { reference, amount, currency, status: 'success' },
});

async function createBooking(body = valid) {
  const res = await post('/api/create-transaction', body);
  assert.equal(res.status, 200);
  return (await res.json()).reference;
}

test('the browser cannot set the price', async () => {
  await createBooking({ ...valid, amount: 1, plan_title: 'Hacked' });
  assert.equal(state.paystackInits[0].amount, 1500000);
  assert.equal(state.bookings[0].amount, 15000);
  assert.equal(state.bookings[0].plan_title, 'Monthly / Semester Plan');
});

test('invalid bookings are rejected and never saved', async () => {
  const bad = [
    { ...valid, plan_id: 'free' },
    { ...valid, plan_id: 'constructor' },
    { ...valid, full_name: '  ' },
    { ...valid, email: 'nope' },
    { ...valid, booking_date: '2000-01-01' },
    { ...valid, booking_date: 'soon' },
  ];
  for (const body of bad) {
    assert.equal((await post('/api/create-transaction', body)).status, 400, JSON.stringify(body));
  }
  assert.equal(state.bookings.length, 0);
});

test('notes are saved and unknown fields are dropped', async () => {
  await createBooking({ ...valid, notes: 'Arriving at noon', status: 'paid', metadata: { booking_id: 'x' } });
  assert.equal(state.bookings[0].status, 'pending');
  assert.equal(state.bookings[0].metadata.notes, 'Arriving at noon');
  assert.equal(state.bookings[0].metadata.booking_id, undefined);
});

test('a failed Paystack start marks the booking failed', async () => {
  state.failPaystack = true;
  assert.equal((await post('/api/create-transaction', valid)).status, 502);
  assert.equal(state.bookings[0].status, 'failed');
});

test('a valid webhook marks the booking paid and sends one email, even when retried', async () => {
  const reference = await createBooking();
  assert.equal((await webhook(charge(reference, 1500000))).status, 200);
  assert.equal((await webhook(charge(reference, 1500000))).status, 200);
  assert.equal(state.bookings[0].status, 'paid');
  assert.equal(state.emails.length, 1);
  assert.equal(state.emails[0].to, 'ada@example.com');
});

test('the emailed pass has the holder, code, validity and a link to the live pass', async () => {
  const reference = await createBooking();
  await webhook(charge(reference, 1500000));
  const { html, subject } = state.emails[0];
  const code = `FET-${reference.slice(4, 12).toUpperCase()}`;
  assert.match(subject, /pass/i);
  for (const expected of ['Ada Obi', code, '15 Jan 2099', '13 Feb 2099', `reference=${reference}`, 'bgcolor="#0B1F3F"']) {
    assert.ok(html.includes(expected), expected);
  }
  assert.ok(Buffer.byteLength(html) < 90_000, 'Gmail clips emails over about 100 KB');
  const data = await (await fetch(`${API}/api/booking-status?reference=${reference}`)).json();
  assert.equal(data.valid_until, '2099-02-13');
});

test('a forged webhook changes nothing', async () => {
  const reference = await createBooking();
  assert.equal((await webhook(charge(reference, 1500000), 'wrong_secret')).status, 401);
  assert.equal((await post('/api/webhook', charge(reference, 1500000))).status, 401);
  assert.equal(state.bookings[0].status, 'pending');
  assert.equal(state.emails.length, 0);
});

test('an underpaid or wrong-currency charge does not mark the booking paid', async () => {
  const reference = await createBooking();
  await webhook(charge(reference, 100));
  await webhook(charge(reference, 1500000, 'USD'));
  assert.equal(state.bookings[0].status, 'pending');
  assert.equal(state.emails.length, 0);
});

test('a database failure tells Paystack to retry, and the retry succeeds', async () => {
  const reference = await createBooking();
  state.failDbWrites = true;
  assert.equal((await webhook(charge(reference, 1500000))).status, 500);
  assert.equal(state.bookings[0].status, 'pending');
  state.failDbWrites = false;
  assert.equal((await webhook(charge(reference, 1500000))).status, 200);
  assert.equal(state.bookings[0].status, 'paid');
});

test('other Paystack events are ignored', async () => {
  const reference = await createBooking();
  assert.equal((await webhook({ event: 'transfer.success', data: { reference, amount: 1500000, currency: 'NGN', status: 'success' } })).status, 200);
  assert.equal(state.bookings[0].status, 'pending');
});

test('the status check confirms payment if the webhook never arrives', async () => {
  const reference = await createBooking();
  state.verify = { status: 'success', amount: 1500000, currency: 'NGN' };
  const res = await fetch(`${API}/api/booking-status?reference=${reference}`);
  const data = await res.json();
  assert.equal(data.status, 'paid');
  assert.equal(data.booking_date, future);
  assert.equal(state.emails.length, 1);
  // The later webhook must not send a second email.
  await webhook(charge(reference, 1500000));
  assert.equal(state.emails.length, 1);
});

test('the status check stays pending for an unpaid transaction and hides internal fields', async () => {
  const reference = await createBooking();
  const data = await (await fetch(`${API}/api/booking-status?reference=${reference}`)).json();
  assert.equal(data.status, 'pending');
  assert.equal(data.id, undefined);
  assert.equal(data.metadata, undefined);
  assert.equal(data.paystack_reference, undefined);
  assert.equal((await fetch(`${API}/api/booking-status?reference=unknown`)).status, 404);
  assert.equal((await fetch(`${API}/api/booking-status`)).status, 400);
});

test('customer input is escaped in emails', async () => {
  const reference = await createBooking({ ...valid, full_name: '<img src=x onerror=alert(1)>' });
  await webhook(charge(reference, 1500000));
  assert.ok(!state.emails[0].html.includes('<img src=x'));
  assert.ok(state.emails[0].html.includes('&lt;img'));
});

test('the contact form emails the hub with reply-to set', async () => {
  const res = await post('/api/contact', { name: 'Ada', email: 'ada@example.com', subject: 'Hi\r\nBcc: x@y.z', message: '<b>Hello</b>' });
  assert.equal(res.status, 200);
  assert.equal(state.emails[0].to, 'inbox@fetuils.ng');
  assert.equal(state.emails[0].reply_to, 'ada@example.com');
  assert.ok(!/[\r\n]/.test(state.emails[0].subject));
  assert.ok(state.emails[0].html.includes('&lt;b&gt;Hello'));
});

test('the contact form rejects bad input and silently drops bots', async () => {
  assert.equal((await post('/api/contact', { name: 'A', email: 'bad', message: 'x' })).status, 400);
  assert.equal((await post('/api/contact', { name: 'A', email: 'a@b.co', message: ' ' })).status, 400);
  assert.equal((await post('/api/contact', { name: 'A', email: 'a@b.co', message: 'x', website: 'spam' })).status, 200);
  assert.equal(state.emails.length, 0);
});

test('removed and locked-down endpoints', async () => {
  assert.equal((await post('/api/test-webhook', {})).status, 404);
  assert.deepEqual(await (await fetch(`${API}/api/health`)).json(), { status: 'ok' });
  assert.equal((await post('/api/create-transaction', '{bad json')).status, 400);
});

test('CORS allows the real site, including www, and no one else', async () => {
  const originFor = async (origin) =>
    (await fetch(`${API}/api/health`, { headers: { Origin: origin } })).headers.get('access-control-allow-origin');
  assert.equal(await originFor('https://fetuils.ng'), 'https://fetuils.ng');
  assert.equal(await originFor('https://www.fetuils.ng'), 'https://www.fetuils.ng');
  assert.equal(await originFor('https://fetuilstechhub.vercel.app'), 'https://fetuilstechhub.vercel.app');
  assert.equal(await originFor('https://evil.example'), null);
});

test('server prices match the prices shown on the website', () => {
  const source = fs.readFileSync(path.join(here, '..', '..', 'src', 'lib', 'plans.ts'), 'utf8');
  const shown = {};
  for (const match of source.matchAll(/id:\s*'([^']+)'[\s\S]*?price:\s*(\d+)/g)) shown[match[1]] = Number(match[2]);
  assert.deepEqual(shown, Object.fromEntries(Object.entries(PLANS).map(([id, plan]) => [id, plan.price])));
});
