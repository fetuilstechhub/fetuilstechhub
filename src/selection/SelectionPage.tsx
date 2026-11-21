// Core team selection (temporary). Remove it with the steps in server/selection/README.md.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BarChart3, ClipboardCheck, KeyRound, List, Loader2, LogOut, MessageCircle, Settings2, Upload, X } from 'lucide-react';
import { Spinner } from '@/components/admin/ui';
import ApplicantDrawer from './ApplicantDrawer';
import ContactQueue from './ContactQueue';
import ListView from './ListView';
import ReviewView from './ReviewView';
import { ImportView, LoginsView, SettingsView, SummaryView } from './AdminViews';
import type { Asked } from './ContactBox';
import {
  SELECTION_API,
  SignedOut,
  TEAMS,
  getName,
  getToken,
  makeCall,
  setName,
  setToken,
  teamLabel,
  type Application,
  type Login,
  type Settings,
} from './api';

const VIEWS = [
  { id: 'review', label: 'Review', icon: ClipboardCheck, admin: false },
  { id: 'list', label: 'Applicants', icon: List, admin: false },
  { id: 'contact', label: 'Contact', icon: MessageCircle, admin: false },
  { id: 'summary', label: 'Summary', icon: BarChart3, admin: true },
  { id: 'import', label: 'Import', icon: Upload, admin: true },
  { id: 'logins', label: 'Logins', icon: KeyRound, admin: true },
  { id: 'templates', label: 'Templates', icon: Settings2, admin: true },
] as const;
type View = (typeof VIEWS)[number]['id'];

const SignIn = ({ onSignedIn }: { onSignedIn: (token: string, login: Login) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${SELECTION_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.token) onSignedIn(body.token, body.login);
      else setError(body.error || 'Could not sign in. Try again.');
    } catch {
      setError('No internet connection. Try again.');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  const field = 'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-[#0B1F3F]';
  return (
    <form onSubmit={submit} className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center gap-3 px-6">
      <img src="/logo.png" alt="FETUILS TechHub" className="mx-auto h-12" />
      <h1 className="text-center text-2xl font-extrabold text-[#0B1F3F]">Core team selection</h1>
      <p className="text-center text-sm text-slate-500">Use the login your team was given.</p>
      <input aria-label="Login email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" autoFocus placeholder="Login email" className={field} />
      <input aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="Password" className={field} />
      {error && <p role="alert" className="text-center font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !email || !password} className="flex h-12 items-center justify-center rounded-xl bg-[#0B1F3F] font-bold text-white disabled:opacity-60">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign in'}
      </button>
    </form>
  );
};

const AskName = ({ onDone }: { onDone: (name: string) => void }) => {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onDone(value.trim());
      }}
      className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center gap-3 px-6"
    >
      <h1 className="text-center text-2xl font-extrabold text-[#0B1F3F]">What's your name?</h1>
      <p className="text-center text-sm text-slate-500">Your team shares this login, so your name is added to everything you do. It goes into messages as {'{{leadName}}'} too.</p>
      <input aria-label="Your name" value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder="e.g. Tolu Bello" className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-[#0B1F3F]" />
      <button type="submit" disabled={!value.trim()} className="h-12 rounded-xl bg-[#0B1F3F] font-bold text-white disabled:opacity-60">Continue</button>
    </form>
  );
};

export default function SelectionPage() {
  const [token, setTokenState] = useState(getToken);
  const [login, setLogin] = useState<Login | null>(null);
  const [leadName, setLeadName] = useState(getName);
  const [apps, setApps] = useState<Application[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [view, setView] = useState<View>('review');
  const [scope, setScope] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [asked, setAsked] = useState<Asked>({});
  const [notice, setNotice] = useState<{ text: string; good: boolean } | null>(null);

  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    document.title = 'Core team selection · FETUILS TechHub';
    return () => robots.remove();
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setLogin(null);
    setApps(null);
    setSettings(null);
    setScope('');
  }, []);
  const call = useMemo(() => makeCall(token ?? '', signOut), [token, signOut]);
  const notify = useCallback((text: string, good = true) => setNotice({ text, good }), []);
  const closeDetail = useCallback(() => setDetailId(null), []);

  const loadApps = useCallback(async () => {
    try {
      setApps((await call<{ applications: Application[] }>('applications')).applications);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    }
  }, [call, notify]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [me, s] = await Promise.all([call<{ login: Login }>('me'), call<{ settings: Settings }>('settings')]);
        setLogin(me.login);
        setSettings(s.settings);
        await loadApps();
      } catch (err) {
        if (!(err instanceof SignedOut)) notify((err as Error).message, false);
      }
    })();
  }, [token, call, loadApps, notify]);

  const isAdmin = login?.role === 'admin';
  const scopes = useMemo(() => {
    if (!login) return [];
    if (isAdmin) return [{ id: 'all', label: 'All teams' }, ...TEAMS];
    return login.teams.map((id) => ({ id, label: teamLabel(id) }));
  }, [login, isAdmin]);
  useEffect(() => {
    if (scopes.length && !scopes.some((s) => s.id === scope)) setScope(scopes[0].id);
  }, [scopes, scope]);

  const replace = useCallback((id: string, change: Partial<Application>) => {
    setApps((list) => list?.map((a) => (a.id === id ? { ...a, ...change } : a)) ?? list);
  }, []);

  // Changes show at once. Saves for one applicant go to the server one at a time, in order,
  // so quick taps on the score never overwrite each other. If the server says no, the list reloads.
  const queues = useRef(new Map<string, { tail: Promise<unknown>; pending: number }>());
  const patch = useCallback(
    (id: string, body: Record<string, unknown>) => {
      setApps((list) =>
        list?.map((a) => {
          if (a.id !== id) return a;
          const next = { ...a };
          if (typeof body.status === 'string') next.status = body.status as Application['status'];
          if (body.rubric && typeof body.rubric === 'object') {
            const rubric = { ...a.rubric } as Record<string, number>;
            for (const [k, v] of Object.entries(body.rubric as Record<string, number | null>)) {
              if (v === null) delete rubric[k];
              else rubric[k] = v;
            }
            next.rubric = rubric;
          }
          return next;
        }) ?? list,
      );
      const queue = queues.current.get(id) ?? { tail: Promise.resolve(), pending: 0 };
      queue.pending += 1;
      const run = async (): Promise<Application | null> => {
        try {
          const { application } = await call<{ application: Application }>(`applications/${id}`, { method: 'PATCH', body: { ...body, by: leadName } });
          // Only the last save in a burst is shown, so the screen never jumps back.
          if (queue.pending === 1) replace(id, application);
          return application;
        } catch (err) {
          if (!(err instanceof SignedOut)) {
            notify((err as Error).message, false);
            loadApps();
          }
          return null;
        } finally {
          queue.pending -= 1;
        }
      };
      const result = queue.tail.then(run, run);
      queue.tail = result;
      queues.current.set(id, queue);
      return result;
    },
    [call, leadName, notify, replace, loadApps],
  );

  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-slate-50">
        <SignIn
          onSignedIn={(t, l) => {
            setToken(t);
            setTokenState(t);
            setLogin(l);
          }}
        />
      </div>
    );
  }
  if (!leadName) {
    return (
      <div className="min-h-[100dvh] bg-slate-50">
        <AskName onDone={(n) => { setName(n); setLeadName(n); }} />
      </div>
    );
  }
  if (!login || !apps || !settings) return <div className="min-h-[100dvh] bg-slate-50"><Spinner /></div>;

  const inScope = scope === 'all' ? apps : apps.filter((a) => a.team === scope);
  const scopeName = scopes.find((s) => s.id === scope)?.label ?? '';
  const views = VIEWS.filter((v) => !v.admin || isAdmin);
  const teamScoped = ['review', 'list', 'contact'].includes(view);

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/logo.png" alt="FETUILS TechHub" className="h-8" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-extrabold text-[#0B1F3F]">Core team selection</div>
              <button
                type="button"
                onClick={() => {
                  const n = window.prompt('Your name', leadName);
                  if (n?.trim()) { setName(n); setLeadName(n.trim()); }
                }}
                className="truncate text-xs text-slate-500 underline-offset-2 hover:underline"
              >
                {leadName} · {login.label}
              </button>
            </div>
          </div>
          <button type="button" onClick={signOut} className="flex h-10 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {views.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setView(id); setNotice(null); }}
              aria-current={view === id ? 'page' : undefined}
              className={`flex h-9 flex-shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ${view === id ? 'bg-[#0B1F3F] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
        {teamScoped && scopes.length > 1 && (
          <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
            {scopes.map((s) => {
              const n = s.id === 'all' ? apps.length : apps.filter((a) => a.team === s.id).length;
              if (s.id === 'unassigned' && !n) return null;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScope(s.id)}
                  className={`h-8 flex-shrink-0 rounded-full px-3 text-xs font-semibold ${scope === s.id ? 'bg-[#E8481C] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  {s.label} · {n}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">
        {notice && (
          <div role="status" className={`mb-4 flex items-start justify-between gap-3 rounded-xl p-3 font-semibold ${notice.good ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
            <span className="break-words">{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-5 w-5" /></button>
          </div>
        )}
        {teamScoped && !apps.length && (
          <p className="rounded-xl bg-white p-6 text-center text-slate-600">
            {isAdmin ? 'No applicants yet. Open Import to add them from the Google Sheet.' : 'No applicants for your team yet. The Lead will import them soon.'}
          </p>
        )}
        {view === 'review' && apps.length > 0 && <ReviewView key={scope} apps={inScope} showPrivate={isAdmin} patch={patch} openDetail={setDetailId} />}
        {view === 'list' && apps.length > 0 && <ListView key={scope} apps={inScope} showTeam={scope === 'all'} showPrivate={isAdmin} scopeName={scopeName} openDetail={setDetailId} />}
        {view === 'contact' && apps.length > 0 && (
          <ContactQueue key={scope} apps={inScope} login={login} leadName={leadName} settings={settings} call={call} notify={notify} replace={replace} asked={asked} setAsked={setAsked} openDetail={setDetailId} />
        )}
        {view === 'summary' && <SummaryView apps={apps} />}
        {view === 'import' && <ImportView call={call} notify={notify} leadName={leadName} onImported={loadApps} />}
        {view === 'logins' && <LoginsView call={call} notify={notify} />}
        {view === 'templates' && <SettingsView settings={settings} call={call} notify={notify} onSaved={setSettings} />}
      </main>

      {detailId && apps.some((a) => a.id === detailId) && (
        <ApplicantDrawer
          app={apps.find((a) => a.id === detailId) as Application}
          login={login}
          leadName={leadName}
          settings={settings}
          call={call}
          notify={notify}
          patch={patch}
          replace={replace}
          asked={asked}
          setAsked={setAsked}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
