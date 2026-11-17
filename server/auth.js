// PIN sign-in shared by the door scanner and the admin. Each has its own PIN and scope,
// so a guard's sign-in never opens the admin. Changing a PIN signs out every device using it.
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest();
export const safeEqual = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b));

export function pinAuth({ pin, secret, scope, minLength, name, limiter }) {
  const configured = typeof pin === 'string' && pin.length >= minLength;
  if (!configured) console.warn(`${name} must be at least ${minLength} characters: ${scope} sign-in is disabled`);

  const sign = (expires) => crypto.createHmac('sha256', `${pin}:${secret}`).update(`${scope}:${expires}`).digest('hex');

  const requireAuth = (req, res, next) => {
    const [expires, signature] = (req.header('authorization') || '').replace(/^Bearer /, '').split('.');
    if (!configured || !expires || !signature || Number(expires) < Date.now() || !safeEqual(signature, sign(expires))) {
      return res.status(401).json({ error: 'sign_in_required' });
    }
    return next();
  };

  // Counts wrong PINs from every device together, so guessing from many
  // connections at once is still slow. Devices already signed in are unaffected.
  const wrongPinLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    keyGenerator: () => `${scope}:all-devices`,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many wrong PINs. Try again in 15 minutes.' },
  });

  const login = (notSetUp) => [
    limiter(10),
    wrongPinLimit,
    (req, res) => {
      if (!configured) return res.status(503).json({ error: notSetUp });
      if (typeof req.body?.pin !== 'string' || !safeEqual(req.body.pin, pin)) {
        return res.status(401).json({ error: 'Wrong PIN.' });
      }
      const expires = String(Date.now() + TOKEN_LIFETIME_MS);
      return res.json({ token: `${expires}.${sign(expires)}` });
    },
  ];

  return { configured, requireAuth, login };
}
