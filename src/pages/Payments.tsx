import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { getToken, setToken } from '@/lib/staff-auth';
import StaffEvents from '@/components/StaffEvents';

const API = `${import.meta.env.VITE_API_BASE_URL}/api/door`;

type Payment = {
  reference: string;
  code: string;
  holder: string;
  email: string;
  plan_id: string;
  plan_title: string;
  amount: number;
  starts_on: string | null;
  notes: string;
  booked_at: string;
  status: string;
};
type Notice = { good: boolean; text: string };

const naira = (amount: number) => `₦${amount.toLocaleString()}`;
const day = (date: string | null) =>
  date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const bookedAt = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });
const passLink = (reference: string) =>
  `${window.location.origin}/booking/confirmation?reference=${encodeURIComponent(reference)}`;

const setupLink = (reference: string) =>
  `${window.location.origin}/events/setup?reference=${encodeURIComponent(reference)}`;

const copyLink = async (link: string) => {
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    window.prompt('Copy this link', link);
    return false;
  }
};

const Login = ({ onSignedIn }: { onSignedIn: (token: string) => void }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.token) onSignedIn(body.token);
      else setError(body.error || 'Could not sign in. Try again.');
    } catch {
      setError('No internet connection. Try again.');
    } finally {
      setBusy(false);
      setPin('');
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-center text-3xl font-extrabold text-[#0B1F3F]">Payments</h1>
      <input
        aria-label="Staff PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        placeholder="Staff PIN"
        className="h-14 rounded-xl border border-slate-300 bg-white px-4 text-center text-2xl font-bold tracking-widest text-[#0B1F3F] placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
      />
      {error && <p role="alert" className="text-center font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !pin} className="flex h-14 items-center justify-center rounded-xl bg-[#0B1F3F] text-lg font-bold text-white disabled:opacity-60">
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Sign in'}
      </button>
    </form>
  );
};

const Details = ({ payment }: { payment: Payment }) => (
  <>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="break-words text-lg font-bold text-[#0B1F3F]">{payment.holder}</div>
        <div className="font-mono text-sm text-slate-600">{payment.code}</div>
      </div>
      <div className="flex-shrink-0 text-xl font-extrabold text-[#0B1F3F]">{naira(payment.amount)}</div>
    </div>
    <div className="mt-2 space-y-0.5 text-sm text-slate-600">
      <div>{payment.plan_title}{payment.starts_on ? `, starts ${day(payment.starts_on)}` : ''}</div>
      <div className="break-all">{payment.email}</div>
      <div className="text-slate-400">Booked {bookedAt(payment.booked_at)}</div>
      {payment.notes && <div className="mt-1 rounded-lg bg-slate-50 p-2 break-words">{payment.notes}</div>}
    </div>
  </>
);

const Waiting = ({ payment, onConfirm }: { payment: Payment; onConfirm: (payment: Payment) => Promise<void> }) => {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    await onConfirm(payment);
    setBusy(false);
    setAsking(false);
  };

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <Details payment={payment} />
      {asking ? (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p className="font-semibold text-amber-950">
            Is {naira(payment.amount)} from {payment.holder} in the bank account?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => setAsking(false)} className="h-12 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700">
              Not yet
            </button>
            <button type="button" disabled={busy} onClick={confirm} className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Yes, send pass'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B1F3F] font-bold text-white">
          <Check className="h-5 w-5" /> Payment received
        </button>
      )}
    </li>
  );
};

const Payments = () => {
  const [token, setTokenState] = useState(getToken);
  const [waiting, setWaiting] = useState<Payment[]>([]);
  const [confirmed, setConfirmed] = useState<Payment[]>([]);
  const [tab, setTab] = useState<'waiting' | 'confirmed' | 'events'>('waiting');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
  }, []);

  const staffCall = useCallback(
    async (path: string) => {
      const response = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401) {
        signOut();
        throw new Error('signed_out');
      }
      if (!response.ok) throw new Error('failed');
      return response.json();
    },
    [signOut, token],
  );
  const eventNotice = useCallback((text: string) => setNotice({ good: !/^Could not/.test(text), text }), []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API}/payments`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401) return signOut();
      if (!response.ok) throw new Error('failed');
      const body = await response.json();
      setWaiting(body.waiting);
      setConfirmed(body.confirmed);
    } catch {
      setNotice({ good: false, text: 'Could not load payments. Check the internet and refresh.' });
    } finally {
      setLoading(false);
    }
  }, [signOut, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmPayment = async (payment: Payment) => {
    setNotice(null);
    try {
      const response = await fetch(`${API}/confirm-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: payment.reference }),
      });
      if (response.status === 401) return signOut();
      if (!response.ok) throw new Error('failed');
      const body = await response.json();
      if (body.already_paid) {
        setNotice({ good: true, text: `${payment.holder} was already confirmed.` });
      } else if (body.email_sent) {
        setNotice({ good: true, text: `Payment confirmed. Pass emailed to ${payment.email}.` });
      } else {
        setNotice({ good: false, text: `Payment confirmed, but the email failed. Open Confirmed, copy ${payment.holder}'s pass link and send it on WhatsApp.` });
      }
      await load();
    } catch {
      setNotice({ good: false, text: 'Could not confirm this payment. Check the internet, refresh and try again.' });
    }
    window.scrollTo({ top: 0 });
  };

  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-slate-50">
        <Login onSignedIn={(t) => { setToken(t); setTokenState(t); }} />
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const matches = (payment: Payment) =>
    !query || [payment.holder, payment.code, payment.email].some((value) => value.toLowerCase().includes(query));
  const shown = (tab === 'waiting' ? waiting : tab === 'confirmed' ? confirmed : []).filter(matches);

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <div className="mx-auto max-w-xl px-4 py-5">
        <header className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-[#0B1F3F]">Payments</h1>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} aria-label="Refresh" className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={signOut} aria-label="Sign out" className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <p className="mt-2 text-sm text-slate-600">
          Only confirm after you see the money in the bank account. Alerts and screenshots can be fake.
        </p>

        {notice && (
          <p role="status" className={`mt-3 rounded-xl p-3 font-semibold ${notice.good ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
            {notice.text}
          </p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1">
          {(['waiting', 'confirmed', 'events'] as const).map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={tab === name}
              onClick={() => setTab(name)}
              className={`h-10 rounded-lg font-semibold ${tab === name ? 'bg-white text-[#0B1F3F] shadow-sm' : 'text-slate-600'}`}
            >
              {name === 'waiting' ? `Waiting (${waiting.length})` : name === 'confirmed' ? 'Confirmed' : 'Events'}
            </button>
          ))}
        </div>

        {tab === 'events' ? (
          <StaffEvents call={staffCall} onNotice={eventNotice} />
        ) : (
        <>
        <input
          aria-label="Search by name, code or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, code or email"
          className="mt-3 h-12 w-full rounded-xl border border-slate-300 bg-white px-4"
        />

        <ul className="mt-3 space-y-3">
          {shown.map((payment) =>
            tab === 'waiting' ? (
              <Waiting key={payment.reference} payment={payment} onConfirm={confirmPayment} />
            ) : (
              <li key={payment.reference} className="rounded-2xl border border-slate-200 bg-white p-4">
                <Details payment={payment} />
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyLink(passLink(payment.reference))) setNotice({ good: true, text: `${payment.holder}'s pass link is copied. Paste it in WhatsApp.` });
                  }}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 font-semibold text-slate-700"
                >
                  <Copy className="h-4 w-4" /> Copy pass link
                </button>
                {payment.plan_id === 'event_hall' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await copyLink(setupLink(payment.reference))) setNotice({ good: true, text: `${payment.holder}'s event setup link is copied. Only send it to the organiser.` });
                    }}
                    className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 font-semibold text-slate-700"
                  >
                    <Copy className="h-4 w-4" /> Copy event setup link
                  </button>
                )}
              </li>
            ),
          )}
        </ul>

        {!loading && shown.length === 0 && (
          <p className="mt-8 text-center text-slate-500">
            {query ? 'No bookings match your search.' : tab === 'waiting' ? 'No bookings are waiting for payment.' : 'No confirmed payments yet.'}
          </p>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default Payments;
