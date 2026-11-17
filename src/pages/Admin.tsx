import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, CreditCard, LayoutDashboard, ListChecks, Loader2, LogOut, Ticket, X } from 'lucide-react';
import { ADMIN_API, getAdminToken, makeAdminCall, setAdminToken } from '@/lib/admin';
import Overview from '@/components/admin/Overview';
import PaymentsSection from '@/components/admin/PaymentsSection';
import BookingsSection from '@/components/admin/BookingsSection';
import CheckInsSection from '@/components/admin/CheckInsSection';
import EventsSection from '@/components/admin/EventsSection';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'bookings', label: 'Bookings', icon: Ticket },
  { id: 'check-ins', label: 'Check-ins', icon: ListChecks },
  { id: 'events', label: 'Events', icon: CalendarDays },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const sectionFromHash = (): SectionId => {
  const id = window.location.hash.replace('#', '');
  return (SECTIONS.find((s) => s.id === id)?.id ?? 'overview') as SectionId;
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
      const response = await fetch(`${ADMIN_API}/login`, {
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
      <img src="/logo.png" alt="FETUILS TechHub" className="mx-auto h-12" />
      <h1 className="text-center text-2xl font-extrabold text-[#0B1F3F]">Admin</h1>
      <input
        aria-label="Admin PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        placeholder="Admin PIN"
        className="h-14 rounded-xl border border-slate-300 bg-white px-4 text-center text-2xl font-bold tracking-widest text-[#0B1F3F] placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
      />
      {error && <p role="alert" className="text-center font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !pin} className="flex h-14 items-center justify-center rounded-xl bg-[#0B1F3F] text-lg font-bold text-white disabled:opacity-60">
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Sign in'}
      </button>
    </form>
  );
};

const Admin = () => {
  const [token, setTokenState] = useState(getAdminToken);
  const [section, setSection] = useState<SectionId>(sectionFromHash);
  const [notice, setNotice] = useState<{ text: string; good: boolean } | null>(null);

  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => {
      robots.remove();
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const signOut = useCallback(() => {
    setAdminToken(null);
    setTokenState(null);
  }, []);
  const call = useMemo(() => makeAdminCall(token ?? '', signOut), [token, signOut]);
  const notify = useCallback((text: string, good = true) => {
    setNotice({ text, good });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const go = useCallback((id: string) => {
    window.location.hash = id;
    setNotice(null);
  }, []);

  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-slate-50">
        <Login onSignedIn={(t) => { setAdminToken(t); setTokenState(t); }} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 lg:flex">
      <aside className="sticky top-0 z-10 border-b border-slate-200 bg-white lg:h-[100dvh] lg:w-60 lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:block lg:py-5">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="FETUILS TechHub" className="h-9" />
            <span className="rounded-md bg-[#0B1F3F] px-1.5 py-0.5 text-xs font-bold text-white">Admin</span>
          </div>
          <button type="button" onClick={signOut} className="flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-600 lg:hidden" aria-label="Sign out">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex h-10 flex-shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${
                section === id ? 'bg-[#0B1F3F] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={signOut} className="mx-3 mt-4 hidden h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 lg:flex">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          {notice && (
            <div role="status" className={`mb-4 flex items-start justify-between gap-3 rounded-xl p-3 font-semibold ${notice.good ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
              <span className="break-words">{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-5 w-5" /></button>
            </div>
          )}
          {section === 'overview' && <Overview call={call} notify={notify} go={go} />}
          {section === 'payments' && <PaymentsSection call={call} notify={notify} />}
          {section === 'bookings' && <BookingsSection call={call} notify={notify} />}
          {section === 'check-ins' && <CheckInsSection call={call} notify={notify} />}
          {section === 'events' && <EventsSection call={call} notify={notify} />}
        </div>
      </main>
    </div>
  );
};

export default Admin;
