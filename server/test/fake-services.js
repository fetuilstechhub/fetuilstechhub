// A small local stand-in for Supabase's REST API, Paystack and Resend.
import crypto from 'node:crypto';
import http from 'node:http';

export const emptyState = () => ({
  bookings: [],
  check_ins: [],
  pass_photos: [],
  emails: [],
  paystackInits: [],
  verify: null,
  failDbWrites: false,
  failPaystack: false,
});

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

const matchesFilter = (row, key, value) => {
  const actual = String(row[key]);
  if (value.startsWith('eq.')) return actual === value.slice(3);
  if (value.startsWith('lt.')) return actual < value.slice(3);
  if (value.startsWith('ilike.')) {
    const pattern = value.slice(6).replace(/[%*]/g, '\u0000').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\u0000/g, '.*');
    return new RegExp(`^${pattern}$`, 'i').test(actual);
  }
  if (value.startsWith('in.(')) return value.slice(4, -1).split(',').map((v) => v.replace(/"/g, '')).includes(actual);
  return true;
};

export function createFakeServices(state, port) {
  let sequence = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const body = await readBody(req);
    const send = (code, value) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    };

    const table = url.pathname.match(/^\/rest\/v1\/(bookings|check_ins|pass_photos)$/)?.[1];
    if (table) {
      let rows = state[table].filter((row) => [...url.searchParams].every(([k, v]) => matchesFilter(row, k, v)));
      if (url.searchParams.get('order')?.includes('desc')) rows = [...rows].reverse();
      const single = (req.headers.accept || '').includes('vnd.pgrst.object');
      const reply = (result) => (single ? send(result[0] ? 200 : 406, result[0] ?? {}) : send(200, result));

      if (req.method === 'GET') return reply(rows);
      if (state.failDbWrites) return send(500, { message: 'db down' });
      if (req.method === 'POST') {
        const row = {
          id: crypto.randomUUID(),
          created_at: new Date(Date.now() + sequence++).toISOString(),
          ...JSON.parse(body)[0],
        };
        if (table === 'check_ins') {
          const clash = state.check_ins.some(
            (c) => c.booking_id === row.booking_id && c.check_in_date === row.check_in_date && c.slot === row.slot,
          );
          if (clash) return send(409, { code: '23505', message: 'duplicate key' });
        }
        if (table === 'pass_photos') {
          state.pass_photos = state.pass_photos.filter((p) => p.booking_id !== row.booking_id);
        }
        state[table].push(row);
        return reply([row]);
      }
      if (req.method === 'PATCH') {
        rows.forEach((row) => Object.assign(row, JSON.parse(body)));
        return reply(rows);
      }
      if (req.method === 'DELETE') {
        state[table] = state[table].filter((row) => !rows.includes(row));
        return reply(rows);
      }
    }

    if (url.pathname === '/transaction/initialize') {
      if (state.failPaystack) return send(400, { status: false, message: 'nope' });
      const init = JSON.parse(body);
      state.paystackInits.push(init);
      return send(200, { status: true, data: { authorization_url: 'https://pay.example/x', reference: init.reference } });
    }
    if (url.pathname.startsWith('/transaction/verify/')) {
      return send(200, { status: true, data: state.verify ?? { status: 'abandoned' } });
    }
    if (url.pathname === '/emails') {
      state.emails.push(JSON.parse(body));
      return send(200, { id: 'email_1' });
    }
    return send(404, { message: `unexpected ${req.method} ${url.pathname}` });
  });
  return server;
}
