// Turns the Google Form responses sheet (downloaded as CSV) into application records.
// The sheet is messy: stray spaces in headers, duplicate questions, typed emails with
// mistakes, phone numbers with letters. Problems are flagged, never silently dropped.

const MAX_ANSWER = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const JUNK_RE = /^(nil+|none|n\/?a|null|nothing|not applicable)$/i;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;

// RFC 4180 CSV: quoted cells may hold commas, doubled quotes and line breaks.
export function parseCsv(text) {
  const s = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export const normaliseHeader = (h) => String(h).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tidy = (v) => String(v ?? '').replace(/\r/g, '').trim();
const oneLine = (v) => tidy(v).replace(/\s+/g, ' ');

// Identity columns: read into named fields and not repeated in the answers.
const IDENTITY_RULES = [
  ['timestamp', (h) => h === 'timestamp'],
  ['email_primary', (h) => h === 'email address'],
  ['email_typed', (h) => h === 'email' || h === 'e mail' || h === 'your email'],
  ['name', (h) => h.includes('full name') || h === 'name'],
  ['phone', (h) => h.includes('phone') || h.includes('whatsapp number')],
  ['unilorin', (h) => h.includes('university of ilorin') || h.includes('unilorin')],
  ['matric', (h) => h.includes('matric') || h.includes('registration number')],
  ['faculty', (h) => h.includes('faculty') || h.includes('department')],
  ['other_role', (h) => h.includes('other') && h.includes('role')],
  ['role', (h) => h.includes('role') && h.includes('applying')],
  ['returning', (h) => h.includes('last session') || h.includes('returning intern')],
];
// Answers that are also used for filters. They stay in the answers too.
const DERIVED_RULES = [
  ['hours', (h) => h.includes('hours') && (h.includes('dedicate') || h.includes('week'))],
  ['on_site', (h) => h.includes('on site') || h.includes('onsite') || h.includes('physically')],
  ['skills', (h) => h.includes('skill')],
];

const TEAM_KEYWORDS = [
  ['technical', ['technical']],
  ['media', ['content', 'media', 'publicity']],
  ['design', ['design', 'brand']],
  // Administration and Logistics applicants belong with Operations.
  ['operations', ['operation', 'admin', 'logistic']],
  ['sales', ['sales']],
  ['partnerships', ['partner']],
  ['community', ['community']],
  ['studio-podcast', ['studio', 'podcast']],
];

export function teamForRole(text) {
  const role = normaliseHeader(text);
  if (!role) return null;
  return TEAM_KEYWORDS.find(([, words]) => words.some((w) => role.includes(w)))?.[0] ?? null;
}

// Nigerian numbers in WhatsApp's international form (2348012345678), or '' if it can't be fixed.
export function phoneForWhatsApp(raw) {
  let s = tidy(raw).replace(/^[oO]/, '0');
  s = s.replace(/\D/g, '');
  if (s.startsWith('2340') && s.length === 14) s = `234${s.slice(4)}`;
  if (s.startsWith('234') && s.length === 13) return s;
  if (s.startsWith('0') && s.length === 11) return `234${s.slice(1)}`;
  if (s.length === 10 && /^[789]/.test(s)) return `234${s}`;
  return '';
}

export function hoursBucket(text) {
  const t = String(text).toLowerCase();
  if (!t.trim()) return 'unknown';
  if (/(above|over|more than|\+)\s*10/.test(t) || /10\s*\+/.test(t)) return '10plus';
  const n = Number(t.match(/\d+(\.\d+)?/)?.[0]);
  if (!Number.isFinite(n) || !t.match(/\d/)) return 'unknown';
  if (n < 5) return 'lt5';
  if (n < 10) return '5to9';
  return '10plus';
}

export function onSiteBucket(text) {
  const t = String(text).trim().toLowerCase();
  if (t.startsWith('yes')) return 'yes';
  if (t.startsWith('no')) return 'no';
  if (t.startsWith('maybe') || t.includes('depend') || t.includes('weekend') || t.includes('sometimes')) return 'maybe';
  return 'unknown';
}

const cleanEmail = (raw) => {
  const e = tidy(raw).toLowerCase().replace(/\s+/g, '');
  // "ada@gmail.com@gmail.com" -> "ada@gmail.com"
  return e.replace(/^([^@]+@([^@]+))@\2$/, '$1');
};

// Google Forms writes "M/D/YYYY H:MM:SS" in the sheet's time zone (Lagos, UTC+1).
export function parseTimestamp(raw) {
  const m = tidy(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, mo, d, y, h, mi, sec = '0'] = m.map(Number);
  const ms = Date.UTC(y, mo - 1, d, h - 1, mi, sec);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

const isJunk = (v) => !v || JUNK_RE.test(v) || /^[\s\p{P}\p{S}]*$/u.test(v);
const yes = (v) => /^y/i.test(tidy(v));

export function readSheet(csvText) {
  const table = parseCsv(csvText);
  const headers = (table[0] ?? []).map((h) => oneLine(h));
  const norm = headers.map(normaliseHeader);
  const identity = {};
  const derived = {};
  const answerColumns = [];
  norm.forEach((h, i) => {
    if (!h) return;
    const id = IDENTITY_RULES.find(([, test]) => test(h))?.[0];
    if (id) (identity[id] ??= []).push(i);
    else answerColumns.push(i);
    const d = DERIVED_RULES.find(([, test]) => test(h))?.[0];
    if (d && !id) (derived[d] ??= []).push(i);
  });

  const missing = [];
  if (!identity.email_primary && !identity.email_typed) missing.push('an email column');
  if (!identity.name) missing.push('Full Name');
  if (!identity.role) missing.push('Which Intern Role are you applying for?');
  if (missing.length) {
    return { error: `This doesn't look like the applications sheet. Missing: ${missing.join(', ')}.` };
  }

  const byKey = new Map();
  const problems = [];
  const unmatchedRoles = {};
  let empty = 0;
  let duplicates = 0;

  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const first = (cols) => (cols ?? []).map((i) => tidy(cells[i])).find((v) => !isJunk(v)) ?? '';
    const name = oneLine(first(identity.name)).slice(0, 120);
    const emailPrimary = cleanEmail(first(identity.email_primary));
    const emailTyped = cleanEmail(first(identity.email_typed));
    if (!name && !emailPrimary && !emailTyped) {
      empty += 1;
      return;
    }

    const issues = [];
    const validPrimary = EMAIL_RE.test(emailPrimary) ? emailPrimary : '';
    const validTyped = EMAIL_RE.test(emailTyped) ? emailTyped : '';
    const email = validPrimary || validTyped;
    let alt = validPrimary && validTyped && validTyped !== validPrimary ? validTyped : '';
    if (emailTyped && !validTyped) {
      issues.push(`Typed email looks wrong: "${emailTyped.slice(0, 80)}"`);
      if (!alt && emailTyped !== email) alt = emailTyped.slice(0, 120);
    }
    if (!email) issues.push('No valid email');

    const roleRaw = oneLine(first(identity.role)).slice(0, 200);
    const otherRole = oneLine(first(identity.other_role)).slice(0, 200);
    const team = teamForRole(roleRaw) ?? teamForRole(otherRole) ?? 'unassigned';
    if (team === 'unassigned') {
      const label = otherRole || roleRaw || '(blank)';
      unmatchedRoles[label] = (unmatchedRoles[label] ?? 0) + 1;
    }

    const phone = oneLine(first(identity.phone)).slice(0, 40);
    const phoneWa = phoneForWhatsApp(phone);
    if (!phoneWa) issues.push(phone ? `Check phone number: "${phone}"` : 'No phone number');

    const answers = [];
    for (const i of answerColumns) {
      const a = tidy(cells[i]).slice(0, MAX_ANSWER);
      if (!isJunk(a)) answers.push({ q: headers[i], a });
    }
    const links = [...new Set(answers.flatMap((x) => x.a.match(URL_RE) ?? []).map((u) => u.replace(/[).,;:!?]+$/, '')))].slice(0, 20);
    const hours = oneLine(first(derived.hours)).slice(0, 200);
    const onSite = oneLine(first(derived.on_site)).slice(0, 200);
    const unilorin = first(identity.unilorin);

    const key = `${email || `name:${name.toLowerCase()}`}__${team}`;
    if (byKey.has(key)) duplicates += 1;
    if (issues.length) problems.push({ row: rowNumber, name: name || email, issues });
    byKey.set(key, {
      source_key: key,
      team,
      applicant_name: name || email,
      applicant_email: email,
      applicant_email_alt: alt,
      phone,
      phone_wa: phoneWa,
      role_raw: otherRole && !teamForRole(roleRaw) ? `${roleRaw || 'Other'}: ${otherRole}` : roleRaw,
      submitted_at: parseTimestamp(first(identity.timestamp)),
      is_unilorin: unilorin ? yes(unilorin) : null,
      faculty_dept: oneLine(first(identity.faculty)).slice(0, 200),
      matric_number: oneLine(first(identity.matric)).slice(0, 60),
      hours_per_week: hours,
      hours_bucket: hoursBucket(hours),
      available_on_site: onSite,
      on_site_bucket: onSiteBucket(onSite),
      skills: first(derived.skills).slice(0, 2000),
      portfolio_links: links,
      returning: yes(first(identity.returning)),
      answers,
      problems: issues,
    });
  });

  return { rows: [...byKey.values()], problems, unmatchedRoles, empty, duplicates, total: table.length - 1 };
}
