import { useCallback, useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { downloadCsv } from '@/lib/admin';
import { Button, Card, Empty, Field, Spinner, inputClass, type Notify } from '@/components/admin/ui';
import {
  PLACEHOLDERS,
  STATUSES,
  SignedOut,
  TEAMS,
  randomPassword,
  renderTemplate,
  teamLabel,
  type Application,
  type Call,
  type Settings,
  type Template,
} from './api';

const fail = (notify: Notify) => (err: unknown) => {
  if (!(err instanceof SignedOut)) notify((err as Error).message, false);
};

// ---- Summary: every team by status.

export function SummaryView({ apps }: { apps: Application[] }) {
  const teams = TEAMS.filter((t) => apps.some((a) => a.team === t.id) || t.id !== 'unassigned');
  const count = (team: string, status?: string) => apps.filter((a) => a.team === team && (!status || a.status === status)).length;
  return (
    <Card className="overflow-x-auto p-0 sm:p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="p-3">Team</th>
            <th className="p-3 text-right">Total</th>
            {STATUSES.map((s) => <th key={s.id} className="p-3 text-right">{s.label}</th>)}
            <th className="p-3 text-right">Reviewed</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => {
            const total = count(t.id);
            const reviewed = total - count(t.id, 'new');
            return (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="p-3 font-semibold text-[#0B1F3F]">{t.label}</td>
                <td className="p-3 text-right font-bold">{total}</td>
                {STATUSES.map((s) => <td key={s.id} className="p-3 text-right">{count(t.id, s.id) || ''}</td>)}
                <td className="p-3 text-right">{total ? `${Math.round((reviewed / total) * 100)}%` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ---- Import: preview the sheet, then write it.

type ImportResult = {
  preview: boolean;
  total: number;
  rows: number;
  created: number;
  updated: number;
  empty: number;
  duplicates: number;
  team_counts: Record<string, number>;
  unmatched_roles: Record<string, number>;
  problems: { row: number; name: string; issues: string[] }[];
  sample: { name: string; email: string; team: string; role: string; phone_ok: boolean }[];
};

export function ImportView({ call, notify, leadName, onImported }: { call: Call; notify: Notify; leadName: string; onImported: () => void }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (commit: boolean, chosen = file) => {
    if (!chosen) return;
    setBusy(true);
    try {
      const q = new URLSearchParams({ file: chosen.name, by: leadName, ...(commit ? { commit: '1' } : {}) });
      const body = await call<ImportResult>(`import?${q}`, { csv: chosen.text });
      setResult(body);
      if (commit) {
        notify(`Imported: ${body.created} new, ${body.updated} updated. Statuses, scores and notes were kept.`);
        onImported();
      }
    } catch (err) {
      fail(notify)(err);
    } finally {
      setBusy(false);
    }
  };

  const choose = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return notify('Choose a .csv file. In Google Sheets: File > Download > Comma-separated values.', false);
    const chosen = { name: f.name, text: await f.text() };
    setFile(chosen);
    setResult(null);
    send(false, chosen);
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-slate-700">
          In the responses Google Sheet: <strong>File &gt; Download &gt; Comma-separated values (.csv)</strong>, then choose that file here. You see a preview before anything is saved.
          Importing again later is safe: new applicants are added, and statuses, scores, notes and messages are never reset.
        </p>
        <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 font-semibold text-slate-600 hover:bg-slate-50">
          <Upload className="h-5 w-5" /> {file ? file.name : 'Choose CSV file'}
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        </label>
      </Card>
      {busy && <Spinner />}
      {result && !busy && (
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Applicants', result.rows],
              ['New', result.created],
              ['Already in', result.updated],
              ['Need a look', result.problems.length],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-3">
                <div className="text-2xl font-extrabold text-[#0B1F3F]">{v}</div>
                <div className="text-xs font-semibold text-slate-500">{k}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            {Object.entries(result.team_counts).map(([t, n]) => `${teamLabel(t)}: ${n}`).join(' · ')}
            {result.duplicates > 0 && ` · ${result.duplicates} repeated submissions (the latest one is kept)`}
            {result.empty > 0 && ` · ${result.empty} empty rows skipped`}
          </p>
          {Object.keys(result.unmatched_roles).length > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              These roles didn't match a team, so they go to <strong>Needs assigning</strong> for you to place: {Object.entries(result.unmatched_roles).map(([r, n]) => `"${r}" (${n})`).join(', ')}
            </p>
          )}
          {result.problems.length > 0 && (
            <details className="rounded-xl border border-slate-200 p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-[#0B1F3F]">{result.problems.length} {result.problems.length === 1 ? 'row needs' : 'rows need'} a look (they are still imported)</summary>
              <ul className="mt-2 space-y-1">
                {result.problems.slice(0, 100).map((p) => (
                  <li key={p.row}>Row {p.row}, {p.name}: {p.issues.join('; ')}</li>
                ))}
              </ul>
              <Button variant="outline" className="mt-2" onClick={() => downloadCsv('import-problems.csv', [['Row', 'Name', 'Problems'], ...result.problems.map((p) => [p.row, p.name, p.issues.join('; ')])])}>
                Download list
              </Button>
            </details>
          )}
          {result.preview ? (
            <Button variant="green" className="w-full" onClick={() => send(true)}>
              Import {result.rows} applicants
            </Button>
          ) : (
            <p className="font-semibold text-emerald-700">Done. Leads can start reviewing.</p>
          )}
        </Card>
      )}
    </div>
  );
}

// ---- Logins: one shared login per team. Passwords are set here and can't be read back.

type LoginRow = { id: string; email: string; label: string; role: 'admin' | 'lead'; teams: string[]; active: boolean; created_at: string };
const LEAD_TEAMS = TEAMS.filter((t) => t.id !== 'unassigned');

const TeamPicker = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => (
  <div className="flex flex-wrap gap-1">
    {LEAD_TEAMS.map((t) => {
      const on = value.includes(t.id);
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
          className={`h-9 rounded-full px-3 text-sm font-semibold ${on ? 'bg-[#0B1F3F] text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
        >
          {t.label}
        </button>
      );
    })}
  </div>
);

export function LoginsView({ call, notify }: { call: Call; notify: Notify }) {
  const [logins, setLogins] = useState<LoginRow[] | null>(null);
  const [envAdmin, setEnvAdmin] = useState('');
  const [form, setForm] = useState({ email: '', label: '', role: 'lead' as 'lead' | 'admin', teams: [] as string[], password: randomPassword() });
  const [shownPassword, setShownPassword] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const body = await call<{ logins: LoginRow[]; env_admin: string }>('logins');
      setLogins(body.logins);
      setEnvAdmin(body.env_admin);
    } catch (err) {
      fail(notify)(err);
    }
  }, [call, notify]);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await call('logins', { body: form });
      setShownPassword({ email: form.email.trim().toLowerCase(), password: form.password });
      setForm({ email: '', label: '', role: 'lead', teams: [], password: randomPassword() });
      load();
    } catch (err) {
      fail(notify)(err);
    } finally {
      setBusy(false);
    }
  };

  const update = async (l: LoginRow, body: Record<string, unknown>, done?: string) => {
    try {
      await call(`logins/${l.id}`, { method: 'PATCH', body });
      if (done) notify(done);
      load();
    } catch (err) {
      fail(notify)(err);
    }
  };

  const resetPassword = async (l: LoginRow) => {
    const password = randomPassword();
    if (!window.confirm(`Give ${l.email} a new password? Everyone using the old one is signed out.`)) return;
    try {
      await call(`logins/${l.id}`, { method: 'PATCH', body: { password } });
      setShownPassword({ email: l.email, password });
    } catch (err) {
      fail(notify)(err);
    }
  };

  const remove = async (l: LoginRow) => {
    if (!window.confirm(`Delete the login ${l.email}? Their past work stays on record.`)) return;
    try {
      await call(`logins/${l.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      fail(notify)(err);
    }
  };

  return (
    <div className="space-y-4">
      {shownPassword && (
        <Card className="border-emerald-300 bg-emerald-50">
          <p className="font-semibold text-emerald-900">Password for {shownPassword.email}. Copy it now: it can't be shown again.</p>
          <p className="mt-2 select-all break-all rounded-xl bg-white p-3 font-mono text-lg text-[#0B1F3F]">{shownPassword.password}</p>
          <p className="mt-2 text-sm text-emerald-900">Send it to the team's leads privately (a direct message, not a group).</p>
          <Button variant="outline" className="mt-2" onClick={() => setShownPassword(null)}>I've copied it</Button>
        </Card>
      )}

      <Card className="space-y-3">
        <h3 className="font-bold text-[#0B1F3F]">New login</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Login email" hint="Doesn't need a real inbox, e.g. design@hub.local">
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} autoComplete="off" />
          </Field>
          <Field label="Name shown in history">
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Design team" className={inputClass} />
          </Field>
        </div>
        <Field label="Kind">
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'lead' | 'admin' })} className={inputClass}>
            <option value="lead">Team login: sees only its teams</option>
            <option value="admin">Admin: sees everything (Co-lead)</option>
          </select>
        </Field>
        {form.role === 'lead' && <TeamPicker value={form.teams} onChange={(teams) => setForm({ ...form, teams })} />}
        <Field label="Password" hint="A random one is filled in. At least 10 characters.">
          <div className="flex gap-2">
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${inputClass} font-mono`} autoComplete="new-password" />
            <Button variant="outline" onClick={() => setForm({ ...form, password: randomPassword() })}>New</Button>
          </div>
        </Field>
        <Button onClick={create} disabled={busy || !form.email || form.password.length < 10 || (form.role === 'lead' && !form.teams.length)}>
          Create login
        </Button>
      </Card>

      {!logins ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {envAdmin && (
            <Card>
              <p className="font-bold text-[#0B1F3F]">{envAdmin}</p>
              <p className="text-sm text-slate-500">Main admin. Its password is set in Render (SELECTION_ADMIN_PASSWORD).</p>
            </Card>
          )}
          {!logins.length && <Empty>No team logins yet.</Empty>}
          {logins.map((l) => (
            <Card key={l.id} className={`space-y-2 ${l.active ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-all font-bold text-[#0B1F3F]">{l.label} <span className="font-normal text-slate-500">· {l.email}</span></p>
                  <p className="text-sm text-slate-500">{l.role === 'admin' ? 'Admin: sees everything' : l.teams.map(teamLabel).join(', ')} · {l.active ? 'On' : 'Switched off'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="h-9 px-3 text-sm" onClick={() => resetPassword(l)}>New password</Button>
                  <Button variant="outline" className="h-9 px-3 text-sm" onClick={() => update(l, { active: !l.active }, l.active ? `${l.email} is off and signed out everywhere.` : `${l.email} is on again.`)}>
                    {l.active ? 'Switch off' : 'Switch on'}
                  </Button>
                  <Button variant="danger" className="h-9 px-3 text-sm" onClick={() => remove(l)}>Delete</Button>
                </div>
              </div>
              {l.role === 'lead' && <TeamPicker value={l.teams} onChange={(teams) => teams.length && update(l, { teams })} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Templates and settings.

const SAMPLE: Record<string, string> = {
  firstName: 'Ada', fullName: 'Ada Obi', team: 'Design and Branding', leadName: 'Tolu', leadTeam: 'Design team',
  interviewDate: 'Friday 28 Nov', interviewTime: '2:00 PM', interviewLink: 'The Hub, Faculty of Engineering',
};

export function SettingsView({ settings, call, notify, onSaved }: { settings: Settings; call: Call; notify: Notify; onSaved: (s: Settings) => void }) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(settings), [settings]);

  const setTemplate = (id: string, change: Partial<Template>) =>
    setDraft({ ...draft, templates: draft.templates.map((t) => (t.id === id ? { ...t, ...change } : t)) });

  const save = async () => {
    setBusy(true);
    try {
      const body = await call<{ settings: Settings }>('settings', { method: 'PUT', body: draft });
      onSaved(body.settings);
      notify('Saved.');
    } catch (err) {
      fail(notify)(err);
    } finally {
      setBusy(false);
    }
  };

  const sample = { ...SAMPLE, groupLink: draft.group_link || '(group link)', session: draft.session_name };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Session">
            <input value={draft.session_name} onChange={(e) => setDraft({ ...draft, session_name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="WhatsApp group link for accepted members" hint="Starts with https://">
            <input value={draft.group_link} onChange={(e) => setDraft({ ...draft, group_link: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Replies to emails go to" hint="Optional, e.g. the hub Gmail">
            <input value={draft.reply_to_email} onChange={(e) => setDraft({ ...draft, reply_to_email: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#0B1F3F]">
          <input type="checkbox" checked={draft.leads_can_accept} onChange={(e) => setDraft({ ...draft, leads_can_accept: e.target.checked })} className="h-5 w-5" />
          Team leads can move applicants to <strong>Accepted</strong> (otherwise only you and the Co-lead can)
        </label>
      </Card>
      <p className="text-sm text-slate-600">Placeholders: {PLACEHOLDERS.map((p) => `{{${p}}}`).join(' ')}</p>
      {draft.templates.map((t) => (
        <Card key={t.id} className="space-y-3">
          <Field label="Template name">
            <input value={t.label} onChange={(e) => setTemplate(t.id, { label: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Email subject">
            <input value={t.subject} onChange={(e) => setTemplate(t.id, { subject: e.target.value })} className={inputClass} />
          </Field>
          <div className="grid gap-3 lg:grid-cols-2">
            <textarea aria-label={`${t.label} message`} value={t.body} onChange={(e) => setTemplate(t.id, { body: e.target.value })} rows={10} className="w-full rounded-xl border border-slate-300 p-3 text-[#0B1F3F]" />
            <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{renderTemplate(t.body, sample)}</div>
          </div>
        </Card>
      ))}
      <Button onClick={save} disabled={busy} className="w-full">{busy ? 'Saving...' : 'Save settings and templates'}</Button>
    </div>
  );
}
