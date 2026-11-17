// Admin sign-in and API calls. The admin token is separate from the door scanner's.
const TOKEN_KEY = 'admin_token';
export const ADMIN_API = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;

export const getAdminToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAdminToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing: sign in again next time.
  }
};

export class SignedOut extends Error {}

export type AdminCall = <T = unknown>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;

export const makeAdminCall = (token: string, onSignedOut: () => void): AdminCall =>
  async (path, options = {}) => {
    const response = await fetch(`${ADMIN_API}/${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (response.status === 401) {
      onSignedOut();
      throw new SignedOut('signed_out');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Something went wrong. Check the internet and try again.');
    return body;
  };

export type Booking = {
  reference: string;
  code: string;
  holder: string;
  email: string;
  plan_id: string;
  plan_title: string;
  amount: number;
  starts_on: string | null;
  valid_until: string | null;
  notes: string;
  booked_at: string;
  paid_at: string | null;
  payment_method: string | null;
  source: string;
  status: 'pending' | 'paid' | 'cancelled' | 'failed';
};

export const naira = (amount: number) => `₦${Number(amount).toLocaleString('en-NG')}`;
export const shortDate = (date: string | null) =>
  date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
export const lagosToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

export const passLink = (reference: string) =>
  `${window.location.origin}/booking/confirmation?reference=${encodeURIComponent(reference)}`;
export const setupLink = (reference: string) =>
  `${window.location.origin}/events/setup?reference=${encodeURIComponent(reference)}`;

export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy this', text);
    return false;
  }
};

// Spreadsheet download. Cells starting with = + - @ are prefixed so Excel never runs them as formulas.
export const downloadCsv = (filename: string, rows: (string | number)[][]) => {
  const cell = (value: string | number) => {
    let s = String(value ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([`${String.fromCharCode(0xfeff)}${rows.map((r) => r.map(cell).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
