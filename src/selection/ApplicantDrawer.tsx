import { useCallback, useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { Button, Spinner, inputClass, type Notify } from '@/components/admin/ui';
import { Answers, Badges, Facts, RubricPicker, StatusPill } from './bits';
import ContactBox, { type Asked } from './ContactBox';
import {
  STATUSES,
  SignedOut,
  TEAMS,
  statusLabel,
  teamLabel,
  when,
  type Activity,
  type Application,
  type Call,
  type Login,
  type Settings,
  type Status,
} from './api';

const describe = (a: Activity) => {
  switch (a.kind) {
    case 'status':
      return `Status: ${statusLabel(a.from_value ?? '')} → ${statusLabel(a.to_value ?? '')}`;
    case 'score':
      return `Score: ${a.to_value}`;
    case 'team':
      return `Team: ${teamLabel(a.from_value ?? '')} → ${teamLabel(a.to_value ?? '')}`;
    case 'track':
      return `Track: ${a.to_value || 'none'}`;
    case 'message':
      return `${a.channel === 'email' ? 'Email sent' : a.channel === 'whatsapp' ? 'WhatsApp opened' : 'Message copied'}${a.undone ? ' (taken back)' : ''}`;
    case 'import':
      return a.text ?? 'Imported';
    default:
      return 'Note';
  }
};

export default function ApplicantDrawer({
  app,
  login,
  leadName,
  settings,
  call,
  notify,
  patch,
  replace,
  asked,
  setAsked,
  onClose,
}: {
  app: Application;
  login: Login;
  leadName: string;
  settings: Settings;
  call: Call;
  notify: Notify;
  patch: (id: string, body: Record<string, unknown>) => Promise<Application | null>;
  replace: (id: string, change: Partial<Application>) => void;
  asked: Asked;
  setAsked: (a: Asked) => void;
  onClose: () => void;
}) {
  const id = app.id;
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'answers' | 'contact' | 'history'>('answers');
  const isAdmin = login.role === 'admin';

  const load = useCallback(async () => {
    try {
      const body = await call<{ application: Application; activity: Activity[] }>(`applications/${id}`);
      setActivity(body.activity);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
      onClose();
    }
  }, [id, call, notify, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const change = async (body: Record<string, unknown>) => {
    if (await patch(id, body)) load();
  };

  const setStatus = (status: Status) => {
    if (status === app.status) return;
    if (status === 'rejected' && !window.confirm(`Reject ${app.applicant_name}?`)) return;
    change({ status });
  };

  const addNote = async () => {
    if (!note.trim()) return;
    try {
      const { activity: entry } = await call<{ activity: Activity }>(`applications/${id}/notes`, { body: { text: note, by: leadName } });
      setActivity((list) => [entry, ...(list ?? [])]);
      setNote('');
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    }
  };

  const undo = async (entry: Activity) => {
    try {
      const contact = await call<Partial<Application>>(`activity/${entry.id}/undo`, { body: {} });
      replace(id, contact);
      setActivity((list) => list?.map((x) => (x.id === entry.id ? { ...x, undone: true } : x)) ?? list);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    }
  };

  const acceptLocked = !isAdmin && !settings.leads_can_accept;
  const notes = (activity ?? []).filter((a) => a.kind === 'note');

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Applicant"
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-xl"
      >
        {!activity ? (
          <Spinner />
        ) : (
          <div className="space-y-5 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-2xl font-extrabold text-[#0B1F3F]">{app.applicant_name}</h2>
                <p className="text-sm text-slate-500">
                  {teamLabel(app.team)} · applied {when(app.submitted_at)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={app.status} />
                  {app.score !== null && <span className="text-sm font-bold text-[#0B1F3F]">{app.score}/100</span>}
                  <Badges app={app} />
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {STATUSES.map((s) => {
                const locked = acceptLocked && (s.id === 'accepted' || app.status === 'accepted');
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={locked}
                    title={locked ? 'Only the Lead or Co-lead can accept' : ''}
                    onClick={() => setStatus(s.id)}
                    className={`h-9 rounded-full px-3 text-sm font-semibold disabled:opacity-40 ${app.status === s.id ? 'bg-[#0B1F3F] text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 text-sm">
              <div className="break-all"><span className="text-slate-500">Email:</span> {app.applicant_email || '—'}</div>
              {app.applicant_email_alt && <div className="break-all"><span className="text-slate-500">Also typed:</span> {app.applicant_email_alt}</div>}
              <div><span className="text-slate-500">Phone:</span> {app.phone || '—'}</div>
              {app.problems.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-800">{app.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            </div>

            {(isAdmin || app.team === 'technical') && (
              <div className="grid gap-3 sm:grid-cols-2">
                {isAdmin && (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-[#0B1F3F]">Team</span>
                    <select value={app.team} onChange={(e) => change({ team: e.target.value })} className={inputClass}>
                      {TEAMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </label>
                )}
                {app.team === 'technical' && (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-[#0B1F3F]">Technical track</span>
                    <select value={app.track} onChange={(e) => change({ track: e.target.value })} className={inputClass}>
                      <option value="">Not decided</option>
                      <option value="innovation">Innovation</option>
                      <option value="training">Training</option>
                    </select>
                  </label>
                )}
              </div>
            )}

            <div className="flex gap-1 border-b border-slate-200">
              {(['answers', 'contact', 'history'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t ? 'border-[#0B1F3F] text-[#0B1F3F]' : 'border-transparent text-slate-500'}`}
                >
                  {t === 'answers' ? 'Application' : t === 'contact' ? 'Contact' : `History (${activity.length})`}
                </button>
              ))}
            </div>

            {tab === 'answers' && (
              <div className="space-y-5">
                <Facts app={app} showPrivate={isAdmin} />
                <div>
                  <h3 className="mb-2 font-bold text-[#0B1F3F]">Score</h3>
                  <RubricPicker rubric={app.rubric} onPick={(key, value) => change({ rubric: { [key]: value } })} />
                </div>
                <div>
                  <h3 className="mb-2 font-bold text-[#0B1F3F]">Answers</h3>
                  <Answers app={app} />
                </div>
                <div>
                  <h3 className="mb-2 font-bold text-[#0B1F3F]">Notes</h3>
                  <div className="flex gap-2">
                    <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Add a note for the team" className={inputClass} />
                    <Button onClick={addNote} disabled={!note.trim()}>Add</Button>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {notes.map((n) => (
                      <li key={n.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <p className="whitespace-pre-wrap break-words text-[#0B1F3F]">{n.text}</p>
                        <p className="mt-1 text-xs text-slate-500">{[n.by_name, n.by_login].filter(Boolean).join(' · ')} · {when(n.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {tab === 'contact' && (
              <ContactBox
                app={app}
                settings={settings}
                leadName={leadName}
                leadTeam={login.label}
                call={call}
                notify={notify}
                asked={asked}
                setAsked={setAsked}
                onContacted={(contact, entry) => {
                  replace(id, contact);
                  setActivity((list) => [entry, ...(list ?? [])]);
                }}
              />
            )}

            {tab === 'history' && (
              <ol className="space-y-2">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="min-w-0">
                      <p className={`font-semibold text-[#0B1F3F] ${a.undone ? 'line-through opacity-60' : ''}`}>{describe(a)}</p>
                      {a.kind === 'note' || a.kind === 'message' ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-slate-600">{a.text}</p> : null}
                      <p className="mt-1 text-xs text-slate-500">{[a.by_name, a.by_login].filter(Boolean).join(' · ')} · {when(a.created_at)}</p>
                    </div>
                    {a.kind === 'message' && a.channel !== 'email' && !a.undone && (
                      <button type="button" onClick={() => undo(a)} className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
