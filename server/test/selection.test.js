// Core team selection: sign-in, team privacy, import, review and contact.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createFakeServices, emptyState } from './fake-services.js';
import { hoursBucket, onSiteBucket, parseCsv, parseTimestamp, phoneForWhatsApp, teamForRole } from '../selection/importer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18817;
const FAKE_PORT = 18818;
const API = `http://127.0.0.1:${PORT}/api/selection`;
const ADMIN = { email: 'lead@hub.local', password: 'admin-pass-123456' };

const state = emptyState();
const fake = createFakeServices(state, FAKE_PORT);
let server;
let admin;

const call = async (route, { token, method, body, csv, query = '' } = {}) => {
  const response = await fetch(`${API}/${route}${query}`, {
    method: method ?? (body || csv ? 'POST' : 'GET'),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csv !== undefined ? { 'Content-Type': 'text/csv' } : body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: csv !== undefined ? csv : body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};
const signIn = async (email, password) => (await call('login', { body: { email, password } })).body.token;

const HEADERS = [
  'Timestamp', 'Email Address', 'Full Name ', 'Email', 'Phone Number', 'Are you a student of University of Ilorin',
  'Faculty/Department', 'Matric Number/Registration Number', 'Which Intern Role are you applying for?',
  'Please specify the "Other" role you are applying for.', 'Were you among the last Session Interns ?',
  'How many hours can you dedicate per week?', 'How many hours can you dedicate per week',
  'Are you available on site?', 'Design portfolio link', 'Why should we pick you?',
];
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const sheet = (rows) => [HEADERS, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
const ROWS = [
  ['11/3/2026 14:05:09', 'ada@gmail.com', 'Ada  Obi', 'ada@gmail.com@gmail.com', 'O803 123 4567', 'Yes', 'Engineering/Civil', '19/30GC001', 'Design Intern', '', 'Yes', '', 'above 10hrs', 'Yes', 'Behance: https://behance.net/ada, @ada', 'I love design,\nand I ship.'],
  ['11/3/2026 15:00:00', 'bayo@gmail.com', 'Bayo Ade', 'haddy', '+234 812 345 6789', 'No', 'Arts', '', 'Sales Intern', '', 'No', '2-4 hours', '', 'Maybe', 'Nil', 'Hard worker'],
  ['11/4/2026 09:00:00', 'chi@gmail.com', 'Chi Eze', 'chi@gmail.com', '0901234567', 'Yes', 'Science', '', '', 'Logistics', 'No', '6-8 hours depending on weekly schedule', '', 'Weekends are guaranteed', '', 'n/a'],
  ['11/4/2026 10:00:00', 'dan@gmail.com', 'Dan Musa', '', '08011112222', 'Yes', 'Engineering', '', 'Other', 'Something new', 'No', '5 hours', '', 'Yes', '', 'Ready'],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['11/5/2026 10:00:00', 'ada@gmail.com', 'Ada Obi', 'ada@gmail.com', '08031234567', 'Yes', 'Engineering/Civil', '19/30GC001', 'Design Intern', '', 'Yes', '', '12 hours', 'Yes', '', 'Updated answer'],
];

before(async () => {
  await new Promise((resolve) => fake.listen(FAKE_PORT, resolve));
  const base = `http://127.0.0.1:${FAKE_PORT}`;
  server = spawn(process.execPath, [path.join(here, '..', 'index.js')], {
    cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'fet-selection-')),
    env: {
      ...process.env,
      PORT: String(PORT),
      SUPABASE_URL: base,
      SUPABASE_SERVICE_ROLE_KEY: 'service_key',
      RESEND_API_KEY: 'resend_key',
      RESEND_API_BASE: base,
      EMAIL_PROVIDERS: 'resend',
      FRONTEND_URL: 'https://fetuils.ng',
      SELECTION_ADMIN_EMAIL: ADMIN.email,
      SELECTION_ADMIN_PASSWORD: ADMIN.password,
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  admin = await signIn(ADMIN.email, ADMIN.password);
  assert.ok(admin);
});

after(() => {
  server?.kill();
  fake.close();
});

test('the messy sheet values are read the way the spec says', () => {
  assert.equal(phoneForWhatsApp('O803 123 4567'), '2348031234567');
  assert.equal(phoneForWhatsApp('+234 812 345 6789'), '2348123456789');
  assert.equal(phoneForWhatsApp('+234 0812 345 6789'), '2348123456789');
  assert.equal(phoneForWhatsApp('8031234567'), '2348031234567');
  assert.equal(phoneForWhatsApp('12345'), '');
  assert.equal(hoursBucket('above 10hrs'), '10plus');
  assert.equal(hoursBucket('2-4 hours'), 'lt5');
  assert.equal(hoursBucket('6-8 hours depending'), '5to9');
  assert.equal(hoursBucket('a lot'), 'unknown');
  assert.equal(onSiteBucket('Yes'), 'yes');
  assert.equal(onSiteBucket('Weekends are guaranteed'), 'maybe');
  assert.equal(teamForRole('Content Management and Social Media Intern'), 'media');
  assert.equal(teamForRole('Media and publicity intern.'), 'media');
  assert.equal(teamForRole('Community Management Team'), 'community');
  assert.equal(teamForRole('Studio and Podcast Intern'), 'studio-podcast');
  assert.equal(teamForRole('Administration'), 'operations');
  assert.equal(teamForRole('Something'), null);
  assert.equal(parseTimestamp('11/3/2026 14:05:09'), '2026-11-03T13:05:09.000Z');
  assert.deepEqual(parseCsv('a,"b, ""c""\nd"\r\n1,2'), [['a', 'b, "c"\nd'], ['1', '2']]);
});

test('nobody gets in without the right password, and wrong logins all look the same', async () => {
  assert.equal((await call('applications')).status, 401);
  assert.equal((await call('applications', { token: 'env-admin.x.9999999999999.abc' })).status, 401);
  const wrong = await call('login', { body: { email: ADMIN.email, password: 'nope-nope-nope' } });
  const unknown = await call('login', { body: { email: 'who@hub.local', password: 'nope-nope-nope' } });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
});

test('import previews first, then writes, and never duplicates on re-import', async () => {
  const csv = sheet(ROWS);
  const preview = await call('import', { token: admin, csv, query: '?file=apps.csv' });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.preview, true);
  assert.equal(state.sel_applications.length, 0);
  assert.equal(preview.body.rows, 4);
  assert.equal(preview.body.duplicates, 1);
  assert.equal(preview.body.empty, 1);
  assert.deepEqual(preview.body.unmatched_roles, { 'Something new': 1 });
  assert.deepEqual(preview.body.team_counts, { design: 1, sales: 1, operations: 1, unassigned: 1 });

  const done = await call('import', { token: admin, csv, query: '?file=apps.csv&commit=1&by=Ameer' });
  assert.equal(done.body.created, 4);
  assert.equal(state.sel_applications.length, 4);
  const ada = state.sel_applications.find((a) => a.applicant_email === 'ada@gmail.com');
  assert.equal(ada.team, 'design');
  assert.equal(ada.applicant_name, 'Ada Obi');
  assert.equal(ada.phone_wa, '2348031234567');
  assert.equal(ada.hours_bucket, '10plus');
  assert.equal(ada.returning_intern, true);
  assert.ok(ada.answers.some((x) => x.a === 'Updated answer'), 'the later duplicate row wins');
  const bayo = state.sel_applications.find((a) => a.applicant_email === 'bayo@gmail.com');
  assert.equal(bayo.is_unilorin, false);
  assert.equal(bayo.applicant_email_alt, 'haddy');
  assert.ok(bayo.problems.some((p) => p.includes('Typed email looks wrong')));
  assert.ok(!bayo.answers.some((x) => x.a === 'Nil'), 'non-answers are not stored');
  const chi = state.sel_applications.find((a) => a.applicant_email === 'chi@gmail.com');
  assert.equal(chi.team, 'operations');
  assert.equal(chi.on_site_bucket, 'maybe');
  assert.equal(state.sel_activity.filter((a) => a.kind === 'import').length, 4);

  // A lead's work and an admin's team move survive a re-import.
  const dan = state.sel_applications.find((a) => a.applicant_email === 'dan@gmail.com');
  await call(`applications/${dan.id}`, { token: admin, method: 'PATCH', body: { team: 'technical', status: 'shortlisted' } });
  const again = await call('import', { token: admin, csv, query: '?commit=1' });
  assert.equal(again.body.created, 0);
  assert.equal(again.body.updated, 4);
  assert.equal(state.sel_applications.length, 4);
  assert.equal(dan.team, 'technical');
  assert.equal(dan.status, 'shortlisted');
});

test('a team login sees only its own team, even by guessing an id', async () => {
  const created = await call('logins', { token: admin, body: { email: 'Design@hub.local', label: 'Design team', teams: ['design'], password: 'short' } });
  assert.equal(created.status, 400);
  const ok = await call('logins', { token: admin, body: { email: 'Design@hub.local', label: 'Design team', teams: ['design', 'unassigned'], password: 'design-pass-2026' } });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.login.teams, ['design'], 'team logins never get "Needs assigning"');
  assert.ok(!JSON.stringify(state.sel_logins).includes('design-pass-2026'), 'passwords are stored hashed');
  assert.equal((await call('logins', { token: admin, body: { email: 'design@hub.local', teams: ['design'], password: 'design-pass-2026' } })).status, 409);
  await call('logins', { token: admin, body: { email: 'sales@hub.local', label: 'Sales team', teams: ['sales'], password: 'sales-pass-2026' } });

  const design = await signIn('design@hub.local', 'design-pass-2026');
  const sales = await signIn('sales@hub.local', 'sales-pass-2026');
  const list = await call('applications', { token: design });
  assert.deepEqual(list.body.applications.map((a) => a.team), ['design']);
  assert.equal(list.body.applications[0].matric_number, undefined, 'matric numbers are admin only');
  assert.equal(list.body.applications[0].source_key, undefined);
  const adaId = list.body.applications[0].id;
  assert.equal((await call(`applications/${adaId}`, { token: sales })).status, 404);
  assert.equal((await call(`applications/${adaId}`, { token: sales, method: 'PATCH', body: { status: 'rejected' } })).status, 404);
  assert.equal((await call(`applications/${adaId}/contact`, { token: sales, body: { channel: 'copy', body: 'hi' } })).status, 404);
  assert.equal((await call('logins', { token: design })).status, 403);
  assert.equal((await call('import', { token: design, csv: sheet(ROWS) })).status, 403);
  assert.equal((await call(`applications/${adaId}`, { token: design, method: 'PATCH', body: { team: 'sales' } })).status, 403);
  assert.equal((await call(`applications/${adaId}`, { token: admin })).body.application.matric_number, '19/30GC001');
});

test('leads review, score and note; only the admin accepts by default', async () => {
  const design = await signIn('design@hub.local', 'design-pass-2026');
  const [ada] = (await call('applications', { token: design })).body.applications;
  const shortlisted = await call(`applications/${ada.id}`, { token: design, method: 'PATCH', body: { status: 'shortlisted', by: 'Tolu' } });
  assert.equal(shortlisted.body.application.status, 'shortlisted');
  const partial = await call(`applications/${ada.id}`, { token: design, method: 'PATCH', body: { rubric: { commitment: 5, skill: 4 } } });
  assert.equal(partial.body.application.score, null);
  const full = await call(`applications/${ada.id}`, { token: design, method: 'PATCH', body: { rubric: { reliability: 4, teamwork: 3, evidence: 4 } } });
  assert.equal(full.body.application.score, 80);
  assert.equal((await call(`applications/${ada.id}`, { token: design, method: 'PATCH', body: { rubric: { skill: 9 } } })).status, 400);
  assert.equal((await call(`applications/${ada.id}`, { token: design, method: 'PATCH', body: { status: 'accepted' } })).status, 403);
  await call(`applications/${ada.id}/notes`, { token: design, body: { text: 'Strong portfolio', by: 'Tolu' } });

  const detail = await call(`applications/${ada.id}`, { token: design });
  const kinds = detail.body.activity.map((a) => a.kind);
  assert.ok(kinds.includes('status') && kinds.includes('score') && kinds.includes('note'));
  const status = detail.body.activity.find((a) => a.kind === 'status');
  assert.equal(status.by_name, 'Tolu');
  assert.equal(status.by_login, 'Design team');

  assert.equal((await call(`applications/${ada.id}`, { token: admin, method: 'PATCH', body: { status: 'accepted' } })).status, 200);
});

test('only selected applicants can be contacted, and email goes from the hub', async () => {
  const sales = await signIn('sales@hub.local', 'sales-pass-2026');
  const [bayo] = (await call('applications', { token: sales })).body.applications;
  assert.equal((await call(`applications/${bayo.id}/contact`, { token: sales, body: { channel: 'whatsapp', body: 'Hello' } })).status, 409);
  await call(`applications/${bayo.id}`, { token: sales, method: 'PATCH', body: { status: 'shortlisted' } });
  const opened = await call(`applications/${bayo.id}/contact`, { token: sales, body: { channel: 'whatsapp', template_id: 'shortlisted', body: 'Hello Bayo' } });
  assert.equal(opened.body.contacted, true);
  const undo = await call(`activity/${opened.body.activity.id}/undo`, { token: sales, body: {} });
  assert.deepEqual(undo.body, { contacted: false, last_contacted_at: null });

  const before = state.emails.length;
  const emailed = await call(`applications/${bayo.id}/contact`, {
    token: sales,
    body: { channel: 'email', subject: 'You are shortlisted', body: 'Hello Bayo <b>\nSee https://fetuils.ng/x' },
  });
  assert.equal(emailed.status, 200);
  const email = state.emails[before];
  assert.equal(email.to, 'bayo@gmail.com');
  assert.ok(email.html.includes('Hello Bayo &lt;b&gt;'), 'the message is escaped');
  assert.ok(email.html.includes('<a href="https://fetuils.ng/x"'));
  assert.equal((await call(`activity/${emailed.body.activity.id}/undo`, { token: sales, body: {} })).status, 409);
});

test('changing a password or switching a login off signs its devices out', async () => {
  const design = await signIn('design@hub.local', 'design-pass-2026');
  const login = state.sel_logins.find((l) => l.email === 'design@hub.local');
  await call(`logins/${login.id}`, { token: admin, method: 'PATCH', body: { password: 'new-design-pass-1' } });
  assert.equal((await call('me', { token: design })).status, 401);
  const fresh = await signIn('design@hub.local', 'new-design-pass-1');
  assert.ok(fresh);
  await call(`logins/${login.id}`, { token: admin, method: 'PATCH', body: { active: false } });
  assert.equal((await call('me', { token: fresh })).status, 401);
  const off = await call('login', { body: { email: 'design@hub.local', password: 'new-design-pass-1' } });
  assert.equal(off.status, 403);
});

test('settings: templates are editable by the admin only', async () => {
  const { body } = await call('settings', { token: admin });
  assert.deepEqual(body.settings.templates.map((t) => t.id), ['shortlisted', 'interview', 'accepted']);
  const sales = await signIn('sales@hub.local', 'sales-pass-2026');
  assert.equal((await call('settings', { token: sales, method: 'PUT', body: body.settings })).status, 403);
  const saved = await call('settings', { token: admin, method: 'PUT', body: { ...body.settings, group_link: 'http://bad', leads_can_accept: true } });
  assert.equal(saved.status, 400);
  const ok = await call('settings', { token: admin, method: 'PUT', body: { ...body.settings, group_link: 'https://chat.whatsapp.com/x', leads_can_accept: true } });
  assert.equal(ok.body.settings.leads_can_accept, true);
  const [bayo] = (await call('applications', { token: sales })).body.applications;
  assert.equal((await call(`applications/${bayo.id}`, { token: sales, method: 'PATCH', body: { status: 'accepted' } })).status, 200);
});

test('a team with two leads splits its unreviewed applicants evenly', async () => {
  const csv = sheet([
    ['11/7/2026 10:00:00', 'p1@gmail.com', 'Pat One', '', '08011110001', 'Yes', 'Arts', '', 'Design Intern', '', 'No', '5 hours', 'Yes', '', 'x'],
    ['11/7/2026 11:00:00', 'p2@gmail.com', 'Pat Two', '', '08011110002', 'Yes', 'Arts', '', 'Design Intern', '', 'No', '5 hours', 'Yes', '', 'x'],
    ['11/7/2026 12:00:00', 'p3@gmail.com', 'Pat Three', '', '08011110003', 'Yes', 'Arts', '', 'Design Intern', '', 'No', '5 hours', 'Yes', '', 'x'],
  ].map((r) => [...r, '']));
  await call('import', { token: admin, csv, query: '?commit=1' });
  const sales = await signIn('sales@hub.local', 'sales-pass-2026');
  assert.equal((await call('split', { token: sales, body: { team: 'design', names: ['A', 'B'] } })).status, 404, 'only your own team');
  assert.equal((await call('split', { token: admin, body: { team: 'design', names: ['Tolu', 'tolu'] } })).status, 400, 'two different names');

  const { body } = await call('split', { token: admin, body: { team: 'design', names: ['Tolu', 'Kemi'] } });
  const newDesign = state.sel_applications.filter((a) => a.team === 'design' && a.status === 'new');
  assert.deepEqual(body.split.map((s) => s.count).reduce((a, b) => a + b, 0), newDesign.length);
  assert.ok(Math.abs(body.split[0].count - body.split[1].count) <= 1);
  assert.ok(newDesign.every((a) => ['Tolu', 'Kemi'].includes(a.assigned_to)));
  assert.ok(state.sel_applications.filter((a) => a.team === 'design' && a.status !== 'new').every((a) => !['Tolu', 'Kemi'].includes(a.assigned_to)), 'reviewed ones are left alone');

  const one = newDesign[0];
  const moved = await call(`applications/${one.id}`, { token: admin, method: 'PATCH', body: { assigned_to: 'Kemi' } });
  assert.equal(moved.body.application.assigned_to, 'Kemi');
});
