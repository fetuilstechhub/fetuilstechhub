// Sends email through one or more providers. EMAIL_PROVIDERS sets the order, for example
// "sendbyte,resend": SendByte is tried first and Resend is the backup if it fails.
// Only providers with an API key set are used. The default is Resend alone.

const PROVIDERS = {
  resend: {
    key: () => process.env.RESEND_API_KEY,
    url: () => `${process.env.RESEND_API_BASE || 'https://api.resend.com'}/emails`,
    body: (payload) => payload,
  },
  sendbyte: {
    key: () => process.env.SENDBYTE_API_KEY,
    url: () => `${process.env.SENDBYTE_API_BASE || 'https://api.sendbyte.africa'}/v1/emails`,
    // SendByte documents only from, to, subject and html, so other fields are left out.
    body: ({ from, to, subject, html }) => ({ from, to, subject, html }),
  },
};

const ATTEMPTS_PER_PROVIDER = 4;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function emailProviders() {
  const order = (process.env.EMAIL_PROVIDERS || 'resend')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => Object.hasOwn(PROVIDERS, name));
  return [...new Set(order)].filter((name) => PROVIDERS[name].key());
}

// Providers allow only a few emails per second, so a refusal with 429 (or a brief
// server error) is retried after a short wait before moving on to the backup provider.
async function sendWith(name, payload) {
  const provider = PROVIDERS[name];
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(provider.url(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${provider.key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(provider.body(payload)),
    });
    if (response.ok) return;
    const detail = await response.text().catch(() => '');
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= ATTEMPTS_PER_PROVIDER) {
      throw new Error(`${name} responded ${response.status}: ${detail.slice(0, 300)}`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 600 * attempt + Math.random() * 400);
  }
}

export async function sendEmail(payload) {
  const providers = emailProviders();
  if (!providers.length) throw new Error('No email provider is set up: add RESEND_API_KEY or SENDBYTE_API_KEY');
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || 'FETUILS TechHub <noreply@fetuils.ng>';
  const errors = [];
  for (const name of providers) {
    try {
      await sendWith(name, { from, ...payload });
      if (errors.length) console.warn('[EMAIL] Sent with backup provider', name, 'after', errors.join(' | '));
      return;
    } catch (err) {
      errors.push(err.message);
    }
  }
  throw new Error(errors.join(' | '));
}
