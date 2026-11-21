// Core team selection API (temporary). Remove it with the steps in server/selection/README.md.
// Team logins only ever receive their own teams' applicants. Matric numbers go to the admin only.
import crypto from 'crypto';
import express, { Router } from 'express';
import { MIN_PASSWORD, hashPassword, selectionAuth } from './auth.js';
import { readSheet } from './importer.js';
import {
  CONTACTABLE,
  DEFAULT_SETTINGS,
  LEAD_TEAM_IDS,
  RUBRIC_KEYS,
  STATUSES,
  TEAM_IDS,
  TRACKS,
  messageEmailHtml,
} from './rules.js';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const UNIQUE_VIOLATION = '23505';
const PAGE = 1000;
const CHUNK = 200;
const BULK_MAX = 25;

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const oneLine = (value, max) => text(value, max).replace(/[\r\n]+/g, ' ');
const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

// Fields the import owns. Everything else (status, scores, notes, contact log) belongs to the leads
// and is never touched by a re-import.
const IMPORTED_FIELDS = [
  'source_key', 'applicant_name', 'applicant_email', 'applicant_email_alt', 'phone', 'phone_wa', 'role_raw',
  'submitted_at', 'is_unilorin', 'faculty_dept', 'matric_number', 'hours_per_week', 'hours_bucket',
  'available_on_site', 'on_site_bucket', 'skills', 'portfolio_links', 'returning_intern', 'answers', 'problems',
];

export function selectionRouter({ supabase, limiter, sendEmail, tokenSecret, frontendUrl }) {
  const router = Router();
  const auth = selectionAuth({ supabase, tokenSecret });

  const guarded = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[SELECTION] Failed', err.message);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
  const route = (method, path, handler, { max = 600, admin = false, before = [] } = {}) =>
    router[method](path, limiter(max), auth.requireLogin, ...(admin ? [auth.requireAdmin] : []), ...before, guarded(handler));

  const isAdmin = (login) => login.role === 'admin';
  const canSee = (login, team) => isAdmin(login) || login.teams.includes(team);
  const who = (req) => ({ by_login: req.login.label || req.login.email, by_name: oneLine(req.body?.by ?? req.query?.by, 60) });

  // Supabase returns at most 1000 rows per request.
  async function fetchAll(build) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build().range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  }

  const forViewer = (row, login) => {
    const { source_key, matric_number, ...rest } = row;
    return isAdmin(login) ? { ...rest, matric_number } : rest;
  };

  async function findApplication(req) {
    if (!UUID_RE.test(req.params.id)) return null;
    const { data, error } = await supabase.from('sel_applications').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw new Error(`Application lookup failed: ${error.message}`);
    // Someone else's team looks exactly like a missing applicant.
    return data && canSee(req.login, data.team) ? data : null;
  }

  async function logActivity(rows) {
    if (!rows.length) return [];
    const { data, error } = await supabase.from('sel_activity').insert(rows).select();
    if (error) throw new Error(`Activity log failed: ${error.message}`);
    return data;
  }

  async function loadSettings() {
    const { data, error } = await supabase.from('sel_settings').select('*').eq('key', 'app').maybeSingle();
    if (error) throw new Error(`Settings lookup failed: ${error.message}`);
    const saved = data?.value ?? {};
    const templates = DEFAULT_SETTINGS.templates.map((t) => ({ ...t, ...(saved.templates ?? []).find((s) => s.id === t.id) }));
    const custom = (saved.templates ?? []).filter((s) => !DEFAULT_SETTINGS.templates.some((t) => t.id === s.id));
    return { ...DEFAULT_SETTINGS, ...saved, templates: [...templates, ...custom] };
  }

  // ---- Sign-in

  router.post('/login', limiter(60), ...auth.login);
  route('get', '/me', (req, res) => res.json({ login: req.login }));

  // ---- Applicants

  route('get', '/applications', async (req, res) => {
    const teams = isAdmin(req.login) ? TEAM_IDS : req.login.teams;
    if (!teams.length) return res.json({ applications: [] });
    const rows = await fetchAll(() =>
      supabase.from('sel_applications').select('*').in('team', teams).order('submitted_at', { ascending: true }),
    );
    return res.json({ applications: rows.map((r) => forViewer(r, req.login)) });
  });

  route('get', '/applications/:id', async (req, res) => {
    const application = await findApplication(req);
    if (!application) return res.status(404).json({ error: 'Applicant not found.' });
    const { data, error } = await supabase
      .from('sel_activity')
      .select('*')
      .eq('application_id', application.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Activity lookup failed: ${error.message}`);
    return res.json({ application: forViewer(application, req.login), activity: data });
  });

  route('patch', '/applications/:id', async (req, res) => {
    const application = await findApplication(req);
    if (!application) return res.status(404).json({ error: 'Applicant not found.' });
    const body = req.body ?? {};
    const changes = {};
    const activity = [];
    const base = { application_id: application.id, ...who(req) };

    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return res.status(400).json({ error: 'Unknown status.' });
      if (body.status !== application.status) {
        if (!isAdmin(req.login) && (body.status === 'accepted' || application.status === 'accepted')) {
          const settings = await loadSettings();
          if (!settings.leads_can_accept) {
            return res.status(403).json({ error: 'Only the Lead or Co-lead can accept applicants. Move them to Interview and tell the Lead.' });
          }
        }
        changes.status = body.status;
        activity.push({ ...base, kind: 'status', from_value: application.status, to_value: body.status });
      }
    }

    if (body.rubric !== undefined) {
      if (!body.rubric || typeof body.rubric !== 'object' || Array.isArray(body.rubric)) return res.status(400).json({ error: 'Bad scores.' });
      const rubric = { ...(application.rubric ?? {}) };
      for (const [key, value] of Object.entries(body.rubric)) {
        if (!RUBRIC_KEYS.includes(key)) return res.status(400).json({ error: 'Unknown score.' });
        if (value === null) delete rubric[key];
        else if (Number.isInteger(value) && value >= 1 && value <= 5) rubric[key] = value;
        else return res.status(400).json({ error: 'Scores go from 1 to 5.' });
      }
      const complete = RUBRIC_KEYS.every((k) => rubric[k]);
      const score = complete ? RUBRIC_KEYS.reduce((sum, k) => sum + rubric[k], 0) * 4 : null;
      changes.rubric = rubric;
      changes.score = score;
      if (score !== null && score !== application.score) {
        activity.push({ ...base, kind: 'score', from_value: application.score === null ? null : String(application.score), to_value: String(score) });
      }
    }

    if (body.track !== undefined) {
      if (!TRACKS.includes(body.track) || application.team !== 'technical') return res.status(400).json({ error: 'Track is only for Technical applicants.' });
      if (body.track !== application.track) {
        changes.track = body.track;
        activity.push({ ...base, kind: 'track', from_value: application.track, to_value: body.track });
      }
    }

    if (body.team !== undefined) {
      if (!isAdmin(req.login)) return res.status(403).json({ error: 'Only the Lead or Co-lead can move applicants between teams.' });
      if (!TEAM_IDS.includes(body.team)) return res.status(400).json({ error: 'Unknown team.' });
      if (body.team !== application.team) {
        // Locked, so a later re-import never moves them back.
        // The new team's leads split their own applicants, so the reviewer is cleared.
        Object.assign(changes, { team: body.team, team_locked: true, assigned_to: '', ...(body.team !== 'technical' ? { track: '' } : {}) });
        activity.push({ ...base, kind: 'team', from_value: application.team, to_value: body.team });
      }
    }

    // Which of the team's leads reviews this applicant ('' = anyone).
    if (body.assigned_to !== undefined && !changes.team) {
      const reviewer = oneLine(body.assigned_to, 60);
      if (reviewer !== (application.assigned_to ?? '')) {
        changes.assigned_to = reviewer;
        activity.push({ ...base, kind: 'reviewer', from_value: application.assigned_to ?? '', to_value: reviewer });
      }
    }

    if (!Object.keys(changes).length) return res.json({ application: forViewer(application, req.login) });
    changes.updated_at = new Date().toISOString();
    changes.updated_by = [base.by_login, base.by_name].filter(Boolean).join(': ');
    const { data, error } = await supabase.from('sel_applications').update(changes).eq('id', application.id).select();
    if (error) throw new Error(`Update failed: ${error.message}`);
    await logActivity(activity);
    return res.json({ application: forViewer(data[0], req.login) });
  });

  // Shares a team's unreviewed applicants evenly between its leads, in the order they applied.
  // Applicants already reviewed keep whoever they were with.
  route('post', '/split', async (req, res) => {
    const team = req.body?.team;
    if (!LEAD_TEAM_IDS.includes(team) || !canSee(req.login, team)) return res.status(404).json({ error: 'Team not found.' });
    const raw = Array.isArray(req.body?.names) ? req.body.names : [];
    const names = [];
    for (const n of raw.map((x) => oneLine(x, 60)).filter(Boolean)) {
      if (!names.some((m) => m.toLowerCase() === n.toLowerCase())) names.push(n);
    }
    if (names.length < 2 || names.length > 6) return res.status(400).json({ error: 'Add between 2 and 6 different names.' });

    const rows = await fetchAll(() =>
      supabase.from('sel_applications').select('id,submitted_at').eq('team', team).eq('status', 'new').order('submitted_at', { ascending: true }),
    );
    const groups = names.map(() => []);
    rows.forEach((r, i) => groups[i % names.length].push(r.id));
    const now = new Date().toISOString();
    const by = [who(req).by_login, who(req).by_name].filter(Boolean).join(': ');
    for (const [i, ids] of groups.entries()) {
      for (const part of chunks(ids, CHUNK)) {
        const { error } = await supabase.from('sel_applications').update({ assigned_to: names[i], updated_at: now, updated_by: by }).in('id', part);
        if (error) throw new Error(`Split failed: ${error.message}`);
      }
    }
    return res.json({ split: names.map((name, i) => ({ name, count: groups[i].length })) });
  }, { max: 60 });

  route('post', '/applications/:id/notes', async (req, res) => {
    const application = await findApplication(req);
    if (!application) return res.status(404).json({ error: 'Applicant not found.' });
    const note = text(req.body?.text, 2000);
    if (!note) return res.status(400).json({ error: 'Write a note first.' });
    const [entry] = await logActivity([{ application_id: application.id, kind: 'note', text: note, ...who(req) }]);
    return res.json({ activity: entry });
  });

  // Records a message to a selected applicant. Email is sent from the hub; WhatsApp and Copy
  // are opened on the lead's phone, so the log says the message was opened, not delivered.
  route('post', '/applications/:id/contact', async (req, res) => {
    const application = await findApplication(req);
    if (!application) return res.status(404).json({ error: 'Applicant not found.' });
    if (!CONTACTABLE.includes(application.status)) {
      return res.status(409).json({ error: 'Only shortlisted, interview or accepted applicants can be contacted.' });
    }
    const channel = req.body?.channel;
    if (!['whatsapp', 'email', 'copy'].includes(channel)) return res.status(400).json({ error: 'Unknown channel.' });
    const message = text(req.body?.body, 4000);
    if (!message) return res.status(400).json({ error: 'The message is empty.' });
    const templateId = oneLine(req.body?.template_id, 60);

    if (channel === 'email') {
      const subject = oneLine(req.body?.subject, 200);
      if (!subject) return res.status(400).json({ error: 'Add a subject.' });
      if (!EMAIL_RE.test(application.applicant_email)) return res.status(400).json({ error: 'This applicant has no valid email. Use WhatsApp.' });
      const settings = await loadSettings();
      try {
        await sendEmail({
          to: application.applicant_email,
          subject,
          html: messageEmailHtml({ body: message, frontendUrl }),
          ...(EMAIL_RE.test(settings.reply_to_email) ? { reply_to: settings.reply_to_email } : {}),
        });
      } catch (err) {
        console.error('[SELECTION] Email failed for', application.id, err.message);
        return res.status(502).json({ error: 'The email could not be sent. Try WhatsApp, or try again later.' });
      }
    }

    const now = new Date().toISOString();
    const [entry] = await logActivity([
      { application_id: application.id, kind: 'message', channel, template_id: templateId, text: message, ...who(req) },
    ]);
    const { error } = await supabase.from('sel_applications').update({ contacted: true, last_contacted_at: now }).eq('id', application.id);
    if (error) throw new Error(`Contact update failed: ${error.message}`);
    return res.json({ activity: entry, contacted: true, last_contacted_at: now });
  }, { max: 300 });

  // Emails many selected applicants at once. Each message is already personalised by the page;
  // every applicant is checked again here (your team, selected, valid email) before sending.
  // The page sends a few at a time so it can show progress.
  route('post', '/contact-bulk', async (req, res) => {
    const list = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!list.length) return res.status(400).json({ error: 'Nobody to email.' });
    if (list.length > BULK_MAX) return res.status(400).json({ error: `Send at most ${BULK_MAX} at a time.` });
    const ids = [...new Set(list.map((m) => m?.id).filter((id) => typeof id === 'string' && UUID_RE.test(id)))];
    const { data: rows, error } = await supabase.from('sel_applications').select('*').in('id', ids);
    if (error) throw new Error(`Applicants lookup failed: ${error.message}`);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const settings = await loadSettings();
    const replyTo = EMAIL_RE.test(settings.reply_to_email) ? { reply_to: settings.reply_to_email } : {};
    const templateId = oneLine(req.body?.template_id, 60);
    const results = [];

    for (const m of list) {
      const app = byId.get(m?.id);
      const name = app?.applicant_name ?? '';
      const subject = oneLine(m?.subject, 200);
      const message = text(m?.body, 4000);
      let reason = '';
      if (!app || !canSee(req.login, app.team)) reason = 'Not found';
      else if (!CONTACTABLE.includes(app.status)) reason = 'Not selected';
      else if (!EMAIL_RE.test(app.applicant_email)) reason = 'No valid email';
      else if (!subject || !message) reason = 'Empty message';
      if (reason) {
        results.push({ id: m?.id, name, ok: false, reason });
        continue;
      }
      try {
        // One at a time keeps within the email provider's sending speed.
        await sendEmail({ to: app.applicant_email, subject, html: messageEmailHtml({ body: message, frontendUrl }), ...replyTo });
      } catch (err) {
        console.error('[SELECTION] Bulk email failed for', app.id, err.message);
        results.push({ id: app.id, name, ok: false, reason: 'Email could not be sent' });
        continue;
      }
      const now = new Date().toISOString();
      await logActivity([{ application_id: app.id, kind: 'message', channel: 'email', template_id: templateId, text: message, ...who(req) }]);
      const { error: updateError } = await supabase.from('sel_applications').update({ contacted: true, last_contacted_at: now }).eq('id', app.id);
      if (updateError) console.error('[SELECTION] Contact update failed', updateError.message);
      results.push({ id: app.id, name, ok: true, last_contacted_at: now });
    }
    return res.json({ results });
  }, { max: 100 });

  // Takes back a WhatsApp or Copy log that was opened by mistake. Sent emails stay on record.
  route('post', '/activity/:id/undo', async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Not found.' });
    const { data: entry, error } = await supabase.from('sel_activity').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw new Error(`Activity lookup failed: ${error.message}`);
    if (!entry || entry.kind !== 'message' || entry.undone) return res.status(404).json({ error: 'Not found.' });
    if (entry.channel === 'email') return res.status(409).json({ error: 'A sent email cannot be taken back.' });
    req.params.id = entry.application_id;
    const application = await findApplication(req);
    if (!application) return res.status(404).json({ error: 'Not found.' });

    await supabase.from('sel_activity').update({ undone: true }).eq('id', entry.id);
    const { data: messages, error: listError } = await supabase.from('sel_activity').select('*').eq('application_id', application.id);
    if (listError) throw new Error(listError.message);
    const left = messages.filter((m) => m.kind === 'message' && !m.undone && m.id !== entry.id).map((m) => m.created_at).sort();
    const contact = { contacted: left.length > 0, last_contacted_at: left.at(-1) ?? null };
    const { error: updateError } = await supabase.from('sel_applications').update(contact).eq('id', application.id);
    if (updateError) throw new Error(updateError.message);
    return res.json(contact);
  });

  // ---- Settings and templates

  route('get', '/settings', async (req, res) => res.json({ settings: await loadSettings() }));

  route('put', '/settings', async (req, res) => {
    const body = req.body ?? {};
    const templates = Array.isArray(body.templates) ? body.templates.slice(0, 20) : [];
    const cleanTemplates = [];
    for (const t of templates) {
      const id = oneLine(t?.id, 40);
      if (!/^[a-z0-9-]+$/.test(id)) return res.status(400).json({ error: 'Each template needs a simple id.' });
      const tpl = { id, label: oneLine(t.label, 60) || id, subject: oneLine(t.subject, 200), body: text(t.body, 4000) };
      if (!tpl.body) return res.status(400).json({ error: `The "${tpl.label}" template is empty.` });
      cleanTemplates.push(tpl);
    }
    const groupLink = text(body.group_link, 300);
    if (groupLink && !/^https:\/\//.test(groupLink)) return res.status(400).json({ error: 'The group link must start with https://' });
    const replyTo = text(body.reply_to_email, 200).toLowerCase();
    if (replyTo && !EMAIL_RE.test(replyTo)) return res.status(400).json({ error: 'The reply-to email looks wrong.' });
    const value = {
      session_name: oneLine(body.session_name, 40) || DEFAULT_SETTINGS.session_name,
      group_link: groupLink,
      reply_to_email: replyTo,
      leads_can_accept: body.leads_can_accept === true,
      templates: cleanTemplates.length ? cleanTemplates : DEFAULT_SETTINGS.templates,
    };
    const { error } = await supabase.from('sel_settings').upsert([{ key: 'app', value, updated_at: new Date().toISOString() }], { onConflict: 'key' });
    if (error) throw new Error(`Settings save failed: ${error.message}`);
    return res.json({ settings: await loadSettings() });
  }, { admin: true });

  // ---- Import (admin). The CSV is sent as text; preview first, then commit.

  route('post', '/import', async (req, res) => {
    if (typeof req.body !== 'string' || !req.body.trim()) {
      return res.status(400).json({ error: 'Choose the CSV file downloaded from Google Sheets.' });
    }
    const sheet = readSheet(req.body);
    if (sheet.error) return res.status(400).json({ error: sheet.error });
    const fileName = oneLine(String(req.query.file ?? ''), 120) || 'applications.csv';
    const commit = req.query.commit === '1';

    const existing = await fetchAll(() => supabase.from('sel_applications').select('id,source_key,team_locked'));
    const known = new Map(existing.map((r) => [r.source_key, r]));
    const created = sheet.rows.filter((r) => !known.has(r.source_key));
    const teamCounts = {};
    for (const r of sheet.rows) teamCounts[r.team] = (teamCounts[r.team] ?? 0) + 1;
    const summary = {
      total: sheet.total,
      rows: sheet.rows.length,
      created: created.length,
      updated: sheet.rows.length - created.length,
      empty: sheet.empty,
      duplicates: sheet.duplicates,
      team_counts: teamCounts,
      unmatched_roles: sheet.unmatchedRoles,
      problems: sheet.problems.slice(0, 500),
      sample: sheet.rows.slice(0, 20).map((r) => ({ name: r.applicant_name, email: r.applicant_email, team: r.team, role: r.role_raw, phone_ok: !!r.phone_wa })),
    };
    if (!commit) return res.json({ preview: true, ...summary });

    const batch = crypto.randomUUID();
    const now = new Date().toISOString();
    const pick = (r, withTeam) => {
      const row = Object.fromEntries(IMPORTED_FIELDS.map((f) => [f, r[f]]));
      return { ...row, ...(withTeam ? { team: r.team } : {}), import_batch: batch, imported_at: now };
    };
    // Rows whose team an admin set by hand keep that team.
    const withTeam = sheet.rows.filter((r) => !known.get(r.source_key)?.team_locked).map((r) => pick(r, true));
    const keepTeam = sheet.rows.filter((r) => known.get(r.source_key)?.team_locked).map((r) => pick(r, false));
    const written = [];
    for (const group of [withTeam, keepTeam]) {
      for (const part of chunks(group, CHUNK)) {
        const { data, error } = await supabase.from('sel_applications').upsert(part, { onConflict: 'source_key' }).select('id,source_key');
        if (error) throw new Error(`Import failed: ${error.message}`);
        written.push(...data);
      }
    }
    const newIds = written.filter((r) => !known.has(r.source_key)).map((r) => r.id);
    for (const part of chunks(newIds, CHUNK)) {
      await logActivity(part.map((id) => ({ application_id: id, kind: 'import', text: `Imported from ${fileName}`, ...who(req) })));
    }
    const { error } = await supabase.from('sel_imports').insert([{
      id: batch,
      file_name: fileName,
      by_name: [who(req).by_login, who(req).by_name].filter(Boolean).join(': '),
      row_count: sheet.rows.length,
      created: summary.created,
      updated: summary.updated,
      skipped: sheet.empty,
      problems: summary.problems,
    }]);
    if (error) console.error('[SELECTION] Could not record import', error.message);
    return res.json({ preview: false, ...summary });
  }, { admin: true, max: 60, before: [express.text({ type: ['text/csv', 'text/plain'], limit: '8mb' })] });

  route('get', '/imports', async (req, res) => {
    const { data, error } = await supabase.from('sel_imports').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return res.json({ imports: data.map(({ problems, ...rest }) => ({ ...rest, problem_count: problems?.length ?? 0 })) });
  }, { admin: true });

  // ---- Team logins (admin). Passwords are hashed; nobody can read one back.

  const cleanTeams = (teams) => (Array.isArray(teams) ? [...new Set(teams.filter((t) => LEAD_TEAM_IDS.includes(t)))] : null);
  const loginRow = (l) => ({ id: l.id, email: l.email, label: l.label, role: l.role, teams: l.teams ?? [], active: l.active, created_at: l.created_at });

  route('get', '/logins', async (req, res) => {
    const { data, error } = await supabase.from('sel_logins').select('*').order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return res.json({ logins: data.map(loginRow), env_admin: auth.envAdminEmail });
  }, { admin: true });

  route('post', '/logins', async (req, res) => {
    const email = text(req.body?.email, 200).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const role = req.body?.role === 'admin' ? 'admin' : 'lead';
    const teams = cleanTeams(req.body?.teams) ?? [];
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Use an email-style login, for example design@hub.local.' });
    if (email === auth.envAdminEmail) return res.status(409).json({ error: 'That email is already the main admin login.' });
    if (password.length < MIN_PASSWORD || password.length > 200) return res.status(400).json({ error: `The password must be at least ${MIN_PASSWORD} characters.` });
    if (role === 'lead' && !teams.length) return res.status(400).json({ error: 'Pick at least one team.' });
    const { data, error } = await supabase
      .from('sel_logins')
      .insert([{ email, label: oneLine(req.body?.label, 60) || email, role, teams, password_hash: await hashPassword(password), pw_version: 1, active: true }])
      .select();
    if (error?.code === UNIQUE_VIOLATION) return res.status(409).json({ error: 'A login with that email already exists.' });
    if (error) throw new Error(error.message);
    return res.json({ login: loginRow(data[0]) });
  }, { admin: true, max: 60 });

  route('patch', '/logins/:id', async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Login not found.' });
    const { data: current, error } = await supabase.from('sel_logins').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!current) return res.status(404).json({ error: 'Login not found.' });
    const body = req.body ?? {};
    const changes = {};
    if (body.label !== undefined) changes.label = oneLine(body.label, 60) || current.email;
    if (body.role !== undefined) changes.role = body.role === 'admin' ? 'admin' : 'lead';
    if (body.teams !== undefined) {
      const teams = cleanTeams(body.teams);
      if (!teams) return res.status(400).json({ error: 'Bad teams.' });
      changes.teams = teams;
    }
    if ((changes.role ?? current.role) === 'lead' && !(changes.teams ?? current.teams ?? []).length) {
      return res.status(400).json({ error: 'Pick at least one team.' });
    }
    let signOut = false;
    if (body.active !== undefined) {
      changes.active = body.active === true;
      if (!changes.active) signOut = true;
    }
    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.trim().length < MIN_PASSWORD || body.password.length > 200) {
        return res.status(400).json({ error: `The password must be at least ${MIN_PASSWORD} characters.` });
      }
      changes.password_hash = await hashPassword(body.password.trim());
      signOut = true;
    }
    // Fewer teams or a role change also signs devices out, so they reload what they can see.
    if (changes.role || changes.teams) signOut = true;
    if (signOut) changes.pw_version = Number(current.pw_version) + 1;
    const { data, error: updateError } = await supabase.from('sel_logins').update(changes).eq('id', current.id).select();
    if (updateError) throw new Error(updateError.message);
    return res.json({ login: loginRow(data[0]) });
  }, { admin: true, max: 120 });

  route('delete', '/logins/:id', async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Login not found.' });
    const { data, error } = await supabase.from('sel_logins').delete().eq('id', req.params.id).select();
    if (error) throw new Error(error.message);
    if (!data.length) return res.status(404).json({ error: 'Login not found.' });
    return res.json({ ok: true });
  }, { admin: true, max: 60 });

  return router;
}
