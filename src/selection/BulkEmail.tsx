import { useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import { Button, Card, inputClass, type Notify } from '@/components/admin/ui';
import type { Asked } from './ContactBox';
import {
  ASKED,
  SignedOut,
  messageValues,
  renderTemplate,
  statusLabel,
  usedPlaceholders,
  type Application,
  type Call,
  type Login,
  type Settings,
  type Status,
} from './api';

const BATCH = 25;
type Result = { id: string; name: string; ok: boolean; reason?: string; last_contacted_at?: string };

// Emails every selected applicant in the list at once, each message personalised with their name.
export default function BulkEmail({
  apps,
  status,
  login,
  leadName,
  settings,
  call,
  notify,
  replace,
  asked,
  setAsked,
  onClose,
}: {
  apps: Application[];
  status: Status;
  login: Login;
  leadName: string;
  settings: Settings;
  call: Call;
  notify: Notify;
  replace: (id: string, change: Partial<Application>) => void;
  asked: Asked;
  setAsked: (a: Asked) => void;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(() => settings.templates.find((t) => t.id === status)?.id ?? settings.templates[0]?.id ?? '');
  const template = settings.templates.find((t) => t.id === templateId);
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  const pick = (id: string) => {
    const t = settings.templates.find((x) => x.id === id);
    setTemplateId(id);
    setSubject(t?.subject ?? '');
    setBody(t?.body ?? '');
  };

  const withEmail = apps.filter((a) => a.applicant_email);
  const noEmail = apps.length - withEmail.length;
  const askedHere = usedPlaceholders(`${subject} ${body}`).filter((p) => ASKED[p]);
  const render = (a: Application) => {
    const values = messageValues(a, settings, leadName, login.label, asked);
    return { subject: renderTemplate(subject, values), body: renderTemplate(body, values) };
  };
  const sample = withEmail[0] ? render(withEmail[0]) : null;
  const unfilled = useMemo(
    () => (sample ? [...new Set([...`${sample.subject} ${sample.body}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))] : []),
    [sample],
  );

  const send = async () => {
    if (!window.confirm(`Send this email to ${withEmail.length} ${statusLabel(status).toLowerCase()} applicants now? This can't be undone.`)) return;
    const all: Result[] = [];
    setProgress({ done: 0, total: withEmail.length });
    for (let i = 0; i < withEmail.length; i += BATCH) {
      const part = withEmail.slice(i, i + BATCH);
      try {
        const { results: got } = await call<{ results: Result[] }>('contact-bulk', {
          body: { template_id: templateId, by: leadName, messages: part.map((a) => ({ id: a.id, ...render(a) })) },
        });
        for (const r of got) if (r.ok) replace(r.id, { contacted: true, last_contacted_at: r.last_contacted_at ?? null });
        all.push(...got);
      } catch (err) {
        if (err instanceof SignedOut) return;
        all.push(...part.map((a) => ({ id: a.id, name: a.applicant_name, ok: false, reason: (err as Error).message })));
      }
      setProgress({ done: Math.min(i + BATCH, withEmail.length), total: withEmail.length });
    }
    setProgress(null);
    setResults(all);
    const sent = all.filter((r) => r.ok).length;
    notify(sent === all.length ? `Email sent to all ${sent}.` : `${sent} sent, ${all.length - sent} not sent. See the list below.`, sent === all.length);
  };

  if (results) {
    const failed = results.filter((r) => !r.ok);
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-[#0B1F3F]">{results.length - failed.length} of {results.length} emails sent.</p>
        {failed.length > 0 && (
          <>
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-800">
              {failed.map((r) => <li key={r.id}>{r.name || 'Applicant'}: {r.reason}</li>)}
            </ul>
            <p className="text-sm text-slate-600">
              They are still in the list below. Message them by WhatsApp, or try "Email all" again later. If many failed, the daily email limit may have been reached.
            </p>
          </>
        )}
        <Button variant="outline" onClick={onClose}>Done</Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-bold text-[#0B1F3F]">Email all {withEmail.length} {statusLabel(status).toLowerCase()}</h3>
        <p className="text-sm text-slate-600">
          Each person gets their own copy with their name filled in. Sent from the hub's email address.
          {noEmail > 0 && ` ${noEmail} without an email are left out: message them by WhatsApp.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {settings.templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            className={`h-9 rounded-full px-3 text-sm font-semibold ${t.id === templateId ? 'bg-[#0B1F3F] text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {askedHere.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {askedHere.map((p) => (
            <label key={p} className="block text-sm">
              <span className="mb-1 block font-medium text-[#0B1F3F]">{ASKED[p]}</span>
              <input value={asked[p] ?? ''} onChange={(e) => setAsked({ ...asked, [p]: e.target.value })} className={inputClass} />
            </label>
          ))}
        </div>
      )}
      <input aria-label="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
      <textarea aria-label="Message for everyone" value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-[#0B1F3F]" />
      <p className="text-xs text-slate-500">Keep {'{{firstName}}'} and the other placeholders: they are filled in for each person.</p>
      {sample && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview for {withEmail[0].applicant_name}</p>
          <p className="mt-1 font-semibold text-[#0B1F3F]">{sample.subject}</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{sample.body}</p>
        </div>
      )}
      {unfilled.length > 0 && (
        <p className="text-sm font-semibold text-amber-700">Fill in: {unfilled.map((p) => ASKED[p] ?? p).join(', ')}{unfilled.includes('groupLink') && ' (the Lead sets the group link in Templates)'}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={send} disabled={!!progress || !withEmail.length || unfilled.length > 0 || !subject.trim() || !body.trim()}>
          <Mail className="h-4 w-4" /> {progress ? `Sending ${progress.done} of ${progress.total}...` : `Send to ${withEmail.length}`}
        </Button>
        <Button variant="outline" onClick={onClose} disabled={!!progress}>Cancel</Button>
      </div>
      {progress && <p className="text-sm text-slate-600">Keep this page open until it finishes.</p>}
    </Card>
  );
}
