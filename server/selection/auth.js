// Email and password sign-in for selection. Team logins are shared by a team's leads and
// stored in sel_logins with scrypt password hashes. The first admin login comes from
// SELECTION_ADMIN_EMAIL and SELECTION_ADMIN_PASSWORD in Render, so nobody has to type a
// password into the database. Changing a password or switching a login off signs out
// every device using it.
import crypto from 'crypto';
import { promisify } from 'util';
import rateLimit from 'express-rate-limit';
import { TEAM_IDS } from './rules.js';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 32;
export const MIN_PASSWORD = 10;
const MIN_ADMIN_PASSWORD = 12;
const ADMIN_LIFETIME_MS = 12 * 60 * 60 * 1000;
const LEAD_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
const ENV_ADMIN_ID = 'env-admin';

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b));

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function checkPassword(password, stored) {
  const [kind, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const key = await scrypt(password, Buffer.from(salt, 'base64'), KEY_LENGTH);
  const expected = Buffer.from(hash, 'base64');
  return expected.length === key.length && crypto.timingSafeEqual(key, expected);
}

// Used when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(KEY_LENGTH).toString('base64')}`;

export function selectionAuth({ supabase, tokenSecret }) {
  const secret = `${tokenSecret}:selection`;
  const adminEmail = (process.env.SELECTION_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.SELECTION_ADMIN_PASSWORD || '';
  const envAdminOn = !!adminEmail && adminPassword.length >= MIN_ADMIN_PASSWORD;
  if (adminEmail && !envAdminOn) console.warn(`SELECTION_ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD} characters: the selection admin login is off`);
  // Changing SELECTION_ADMIN_PASSWORD changes this, which signs the admin out everywhere.
  const envVersion = crypto.createHmac('sha256', secret).update(adminPassword).digest('hex').slice(0, 16);

  const envAdmin = { id: ENV_ADMIN_ID, email: adminEmail, label: 'Lead', role: 'admin', teams: TEAM_IDS };

  const sign = (payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const issue = (login, version) => {
    const expires = Date.now() + (login.role === 'admin' ? ADMIN_LIFETIME_MS : LEAD_LIFETIME_MS);
    const payload = `${login.id}.${version}.${expires}`;
    return `${payload}.${sign(payload)}`;
  };

  const publicLogin = (l) => ({ id: l.id, email: l.email, label: l.label, role: l.role, teams: l.role === 'admin' ? TEAM_IDS : l.teams ?? [] });

  async function resolve(token) {
    const parts = String(token).split('.');
    if (parts.length !== 4) return null;
    const [id, version, expires, signature] = parts;
    if (Number(expires) < Date.now() || !safeEqual(signature, sign(`${id}.${version}.${expires}`))) return null;
    if (id === ENV_ADMIN_ID) return envAdminOn && version === envVersion ? envAdmin : null;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data, error } = await supabase.from('sel_logins').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Login lookup failed: ${error.message}`);
    if (!data || !data.active || String(data.pw_version) !== version) return null;
    return publicLogin(data);
  }

  const requireLogin = async (req, res, next) => {
    try {
      const login = await resolve((req.header('authorization') || '').replace(/^Bearer /, ''));
      if (!login) return res.status(401).json({ error: 'sign_in_required' });
      req.login = login;
      return next();
    } catch (err) {
      console.error('[SELECTION] Sign-in check failed', err.message);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };

  const requireAdmin = (req, res, next) =>
    req.login?.role === 'admin' ? next() : res.status(403).json({ error: 'Only the Lead or Co-lead can do this.' });

  // Wrong passwords are limited per address and across every device together.
  const failureLimit = (limit, keyGenerator) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      ...(keyGenerator ? { keyGenerator } : {}),
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many wrong passwords. Try again in 15 minutes.' },
    });
  const perAddress = failureLimit(10);
  const everywhere = failureLimit(40, () => 'selection:all-devices');

  const login = [
    perAddress,
    everywhere,
    async (req, res) => {
      try {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 200) : '';
        const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
        if (!email || !password) return res.status(401).json({ error: 'Wrong email or password.' });

        if (envAdminOn && safeEqual(email, adminEmail)) {
          if (!safeEqual(password, adminPassword)) return res.status(401).json({ error: 'Wrong email or password.' });
          return res.json({ token: issue(envAdmin, envVersion), login: publicLogin(envAdmin) });
        }
        const { data, error } = await supabase.from('sel_logins').select('*').eq('email', email).maybeSingle();
        if (error) throw new Error(`Login lookup failed: ${error.message}`);
        const ok = await checkPassword(password, data?.password_hash ?? DUMMY_HASH);
        if (!data || !ok) return res.status(401).json({ error: 'Wrong email or password.' });
        if (!data.active) return res.status(403).json({ error: 'This login is switched off. Contact the Lead.' });
        return res.json({ token: issue(data, String(data.pw_version)), login: publicLogin(data) });
      } catch (err) {
        console.error('[SELECTION] Login failed', err.message);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
      }
    },
  ];

  return { login, requireLogin, requireAdmin, publicLogin, envAdminEmail: envAdminOn ? adminEmail : '' };
}
