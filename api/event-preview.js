// Serves /events/<slug> with that event's name and date in the link-preview tags,
// so WhatsApp and other apps show the event instead of the general site preview.
// The page itself is the normal site, which then loads the event as usual.
const API_BASE = process.env.VITE_API_BASE_URL || 'https://fetuilstechhub.onrender.com';
const SLUG_RE = /^[a-z0-9-]{3,80}$/;
// Long enough for a warm API, short enough that a sleeping one doesn't hold up the page.
const EVENT_TIMEOUT_MS = 4000;

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function fetchEvent(slug) {
  if (!SLUG_RE.test(slug)) return null;
  try {
    const response = await fetch(`${API_BASE}/api/events/${slug}`, { signal: AbortSignal.timeout(EVENT_TIMEOUT_MS) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export function withEventTags(html, event, url, origin) {
  if (!event) return html;
  const when = new Date(event.starts_at);
  const date = when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });
  const time = when.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
  const title = escapeHtml(`${event.title} · FETUILS TechHub`);
  const description = escapeHtml(
    event.open
      ? `${date}, ${time} at FETUILS TechHub, NLNG, UNILORIN. Register with your name and email to get your event pass.`
      : `${date}, ${time} at FETUILS TechHub, NLNG, UNILORIN. Registration has closed.`,
  );
  const image = `${origin}/og-event.png`;

  const set = (pattern, replacement) => {
    html = pattern.test(html) ? html.replace(pattern, replacement) : html;
  };
  set(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  set(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}">`);
  set(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}" />`);
  set(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${description}" />`);
  set(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escapeHtml(url)}" />`);
  set(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="FETUILS TechHub event invitation" />`);
  set(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${image}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />`);
  return html;
}

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `https://${host}`;
  const slug = String(req.query.slug || '').toLowerCase();

  const [page, event] = await Promise.all([
    fetch(`${origin}/index.html`).then((r) => (r.ok ? r.text() : null)).catch(() => null),
    fetchEvent(slug),
  ]);
  if (!page) {
    res.status(502).send('Please refresh the page.');
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // A found event is cached briefly so busy links stay fast; anything else is not cached.
  res.setHeader('Cache-Control', event ? 'public, s-maxage=300, stale-while-revalidate=600' : 'no-store');
  res.status(200).send(withEventTags(page, event, `${origin}/events/${slug}`, origin));
}
