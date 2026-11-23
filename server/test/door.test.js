// Door scanner rules, run against the real server with fake outside services.
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
const PORT = 18797;
const NO_PIN_PORT = 18799;
const FAKE_PORT = 18798;
const API = `http://127.0.0.1:${PORT}`;
const PIN = '482913';
const PHOTO = 'data:image/jpeg;base64,/9j/AAAA';

let state = emptyState();
const stateProxy = new Proxy({}, {
  get: (_, key) => state[key],
  set: (_, key, value) => { state[key] = value; return true; },
});
const fake = createFakeServices(stateProxy, FAKE_PORT);
const servers = [];
let token;

const lagos = (offsetDays = 0) => {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
};

async function startServer(port, extraEnv) {
  const base = `http://127.0.0.1:${FAKE_PORT}`;
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'fet-door-'));
  const child = spawn(process.execPath, [path.join(here, '..', 'index.js')], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      PAYMENT_MODE: 'paystack',
      SUPABASE_URL: base,
      SUPABASE_SERVICE_ROLE_KEY: 'service_key',
      PAYSTACK_SECRET_KEY: 'test_secret',
      PAYSTACK_API_BASE: base,
      RESEND_API_KEY: 'resend_key',
      RESEND_API_BASE: base,
      RESEND_FROM_EMAIL: 'test@fetuils.ng',
      FRONTEND_URL: 'https://fetuils.ng',
      STAFF_PIN: '',
      ...extraEnv,
    },
    stdio: 'ignore',
  });
  servers.push(child);
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('server did not start');
}

const post = (route, body, auth = token, base = API) =>
  fetch(`${base}/api/door/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body),
  });
const scan = async (reference) => (await post('scan', { reference })).json();
const checkIn = async (reference, photo) => (await post('check-in', { reference, photo })).json();

function addBooking({ plan = 'daily', status = 'paid', start = lagos(), end = start, reference, name = 'Ada Obi', ...over } = {}) {
  const ref = reference ?? `fet_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  state.bookings.push({
    id: crypto.randomUUID(),
    full_name: name,
    email: 'ada@example.com',
    plan_id: plan,
    plan_title: `Title ${plan}`,
    amount: 1000,
    currency: 'NGN',
    status,
    paystack_reference: ref,
    metadata: { booking_date: start, valid_until: end },
    ...over,
  });
  return ref;
}

before(async () => {
  await new Promise((resolve) => fake.listen(FAKE_PORT, resolve));
  await startServer(PORT, { STAFF_PIN: PIN });
  await startServer(NO_PIN_PORT, {});
  token = (await (await post('login', { pin: PIN }, null)).json()).token;
  assert.ok(token);
});

after(() => {
  servers.forEach((s) => s.kill());
  fake.close();
  fake.closeAllConnections();
});

beforeEach(() => {
  state = emptyState();
});

test('the scanner needs the right PIN', async () => {
  assert.equal((await post('login', { pin: '000000' }, null)).status, 401);
  assert.equal((await post('login', {}, null)).status, 401);
  assert.equal((await post('scan', { reference: 'x' }, null)).status, 401);
  assert.equal((await post('scan', { reference: 'x' }, 'abc.def')).status, 401);
  const [expires] = token.split('.');
  assert.equal((await post('scan', { reference: 'x' }, `${Number(expires) + 1000}.${token.split('.')[1]}`)).status, 401);
  assert.equal((await post('scan', { reference: 'x' }, `1000.${token.split('.')[1]}`)).status, 401);
  assert.equal((await fetch(`${API}/api/door/entries`)).status, 401);
});

test('with no PIN set, the scanner stays locked', async () => {
  const base = `http://127.0.0.1:${NO_PIN_PORT}`;
  assert.equal((await post('login', { pin: '' }, null, base)).status, 503);
  assert.equal((await post('scan', { reference: 'x' }, token, base)).status, 401);
});

test('a daily pass opens the door once, and a shared screenshot gets red', async () => {
  const reference = addBooking();
  const first = await scan(reference);
  assert.equal(first.verdict, 'enter');
  assert.equal(first.holder, 'Ada Obi');
  const second = await scan(reference);
  assert.equal(second.verdict, 'deny');
  assert.equal(second.reason, 'used');
  assert.ok(second.last_entry_at);
  assert.equal(state.check_ins.length, 1);
});

test('two phones scanning the same pass at once give only one green', async () => {
  const reference = addBooking();
  const results = await Promise.all(Array.from({ length: 6 }, () => scan(reference)));
  assert.equal(results.filter((r) => r.verdict === 'enter').length, 1);
  assert.equal(results.filter((r) => r.reason === 'used').length, 5);
  assert.equal(state.check_ins.length, 1);
});

test('fake, unpaid, early and expired passes get red', async () => {
  assert.equal((await scan('fet_doesnotexist')).reason, 'not_found');
  assert.equal((await scan('bad reference!')).reason, 'not_found');
  assert.equal((await scan(addBooking({ status: 'pending' }))).reason, 'not_paid');
  assert.equal((await scan(addBooking({ status: 'failed' }))).reason, 'not_paid');
  assert.equal((await scan(addBooking({ start: lagos(2), end: lagos(2) }))).reason, 'not_started');
  assert.equal((await scan(addBooking({ start: lagos(-9), end: lagos(-3) }))).reason, 'expired');
  assert.equal((await scan(addBooking({ plan: 'test' }))).reason, 'invalid_plan');
  assert.equal(state.check_ins.length, 0);
});

test('yesterday\'s daily pass is expired', async () => {
  assert.equal((await scan(addBooking({ start: lagos(-1), end: lagos(-1) }))).reason, 'expired');
});

test('a paid pass still works if the Paystack confirmation was missed', async () => {
  state.verify = { status: 'success', amount: 100000, currency: 'NGN' };
  const result = await scan(addBooking({ status: 'pending' }));
  assert.equal(result.verdict, 'enter');
});

test('older bookings with no end date still work', async () => {
  const reference = addBooking({ plan: 'daily', metadata: { booking_date: lagos() } });
  assert.equal((await scan(reference)).verdict, 'enter');
  const oldest = addBooking({ plan: 'daily', metadata: {}, start_time: `${lagos()}T09:00:00.000Z` });
  assert.equal((await scan(oldest)).verdict, 'enter');
});

test('a weekly pass needs a photo first, then opens once per day', async () => {
  const reference = addBooking({ plan: 'weekly', start: lagos(-1), end: lagos(5) });

  const first = await scan(reference);
  assert.equal(first.verdict, 'take_photo');
  assert.equal(state.check_ins.length, 0, 'no entry until the photo is taken');

  assert.equal((await post('check-in', { reference })).status, 400);
  assert.equal((await post('check-in', { reference, photo: 'data:text/html,<script>' })).status, 400);
  assert.equal((await post('check-in', { reference, photo: `data:image/jpeg;base64,${'A'.repeat(90_000)}` })).status, 400);

  assert.equal((await checkIn(reference, PHOTO)).verdict, 'enter');
  assert.equal(state.pass_photos.length, 1);
  assert.equal(state.pass_photos[0].expires_on, lagos(5));

  const again = await scan(reference);
  assert.equal(again.verdict, 'deny');
  assert.equal(again.reason, 'used');
  assert.equal(again.photo, undefined);
});

test('on later days the guard compares the photo, and saying no costs the holder nothing', async () => {
  const reference = addBooking({ plan: 'monthly', start: lagos(-3), end: lagos(20) });
  await scan(reference);
  await checkIn(reference, PHOTO);
  state.check_ins.forEach((c) => { c.check_in_date = lagos(-1); });

  const next = await scan(reference);
  assert.equal(next.verdict, 'confirm_photo');
  assert.equal(next.photo, PHOTO);
  assert.equal(state.check_ins.filter((c) => c.check_in_date === lagos()).length, 0, 'scanning alone does not use today');

  assert.equal((await checkIn(reference)).verdict, 'enter');
  assert.equal((await scan(reference)).reason, 'used');
  assert.equal(state.pass_photos.length, 1);
});

test('a check-in cannot skip the rules', async () => {
  const reference = addBooking({ plan: 'weekly', start: lagos(-9), end: lagos(-3) });
  assert.equal((await checkIn(reference, PHOTO)).reason, 'expired');
  assert.equal((await post('check-in', { reference: 'fet_nope', photo: PHOTO })).status, 200);
  assert.equal((await checkIn('fet_nope', PHOTO)).reason, 'not_found');
  assert.equal(state.check_ins.length, 0);
  assert.equal(state.pass_photos.length, 0);
});

test('a team pass allows five entries a day and needs no photo', async () => {
  const reference = addBooking({ plan: 'team_startup', end: lagos(29) });
  for (let entry = 1; entry <= 5; entry++) {
    const result = await scan(reference);
    assert.equal(result.verdict, 'enter');
    assert.equal(result.entries_today, entry);
    assert.equal(result.entries_allowed, 5);
  }
  assert.equal((await scan(reference)).reason, 'used');
});

test('a team pass never goes over five, even from many phones at once', async () => {
  const reference = addBooking({ plan: 'team_startup', end: lagos(29) });
  const results = await Promise.all(Array.from({ length: 9 }, () => scan(reference)));
  assert.equal(results.filter((r) => r.verdict === 'enter').length, 5);
  assert.equal(state.check_ins.length, 5);
});

test('a typed code finds the pass and follows the same rules', async () => {
  const reference = addBooking({ reference: 'fet_a1b2c3d4e5f607182930' });
  const scanCode = async (code) => (await post('scan', { code })).json();
  assert.equal((await scanCode('FET-A1B2C3D4')).verdict, 'enter');
  assert.equal((await scanCode('fet-a1b2c3d4')).reason, 'used');
  assert.equal((await scanCode('FET-ZZZZZZZZ')).reason, 'not_found');
  assert.equal((await scanCode('%')).reason, 'not_found');
  addBooking({ reference: 'abcd1234xy' });
  assert.equal((await scanCode('FET-ABCD1234')).verdict, 'enter');
  assert.ok(reference);
});

test('a wildcard in a typed code cannot match someone else', async () => {
  addBooking();
  const result = await (await post('scan', { code: 'FET-%%%%%%%%' })).json();
  assert.equal(result.reason, 'not_found');
});

test('photos are deleted after the pass ends', async () => {
  state.pass_photos.push({ booking_id: 'old', image: PHOTO, expires_on: lagos(-1) });
  state.pass_photos.push({ booking_id: 'current', image: PHOTO, expires_on: lagos(3) });
  const reference = addBooking({ plan: 'weekly', end: lagos(6) });
  await checkIn(reference, PHOTO);
  assert.deepEqual(state.pass_photos.map((p) => p.booking_id).includes('old'), false);
  assert.equal(state.pass_photos.length, 2);
});

test('the entry log lists today\'s entries without photos', async () => {
  await scan(addBooking({ name: 'Ada Obi' }));
  await scan(addBooking({ name: 'Tunde Bello' }));
  const { entries } = await (await fetch(`${API}/api/door/entries`, { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.deepEqual(entries.map((e) => e.holder), ['Tunde Bello', 'Ada Obi']);
  assert.equal(JSON.stringify(entries).includes('base64'), false);
});

test('a database failure never shows green', async () => {
  const reference = addBooking();
  state.failDbWrites = true;
  const response = await post('scan', { reference });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).verdict, undefined);
});

test('wrong PINs are capped across all devices, and a right PIN still works', async () => {
  // Each attempt comes from a different address, as if spread over many phones.
  let blocked = false;
  for (let i = 0; i < 31 && !blocked; i++) {
    const res = await fetch(`${API}/api/door/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.${i}.1` },
      body: JSON.stringify({ pin: '000000' }),
    });
    blocked = res.status === 429;
  }
  assert.ok(blocked, 'expected wrong PINs to be blocked');
  const scanStillWorks = await post('scan', { reference: 'fet_unknown' });
  assert.equal(scanStillWorks.status, 200);
});
