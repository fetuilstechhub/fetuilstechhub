import { useEffect, useMemo, useState } from 'react';
import { Copy, Mail, MessageCircle } from 'lucide-react';
import { Button, inputClass, type Notify } from '@/components/admin/ui';
import {
  ASKED,
  CONTACTABLE,
  SignedOut,
  firstName,
  openOutside,
  renderTemplate,
  teamLabel,
  usedPlaceholders,
  whatsappLink,
  type Activity,
  type Application,
  type Call,
  type Settings,
} from './api';

export type Asked = Record<string, string>;

const defaultTemplate = (status: string, settings: Settings) =>
  settings.templates.find((t) => t.id === status)?.id ?? settings.templates[0]?.id ?? '';

export default function ContactBox({
  app,
  settings,
  leadName,
  leadTeam,
  call,
  notify,
  asked,
  setAsked,
  onContacted,
}: {
  app: Application;
  settings: Settings;
  leadName: string;
  leadTeam: string;
  call: Call;
  notify: Notify;
  asked: Asked;
  setAsked: (a: Asked) => void;
  onContacted: (change: Partial<Application>, entry: Activity) => void;
}) {
  const [templateId, setTemplateId] = useState(() => defaultTemplate(app.status, settings));
  const template = settings.templates.find((t) => t.id === templateId);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => setTemplateId(defaultTemplate(app.status, settings)), [app.id, app.status, settings]);

  const values = useMemo(
    () => ({
      firstName: firstName(app.applicant_name),
      fullName: app.applicant_name,
      team: teamLabel(app.team),
      leadName,
      leadTeam,
      groupLink: settings.group_link,
      session: settings.session_name,
      ...asked,
    }),
    [app, leadName, leadTeam, settings, asked],
  );
  const askedHere = template ? usedPlaceholders(`${template.subject} ${template.body}`).filter((p) => ASKED[p]) : [];

  useEffect(() => {
    setMessage(template ? renderTemplate(template.body, values) : '');
    setSubject(template ? renderTemplate(template.subject, values) : '');
  }, [template, values]);

  if (!CONTACTABLE.includes(app.status)) {
    return (
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        Messages open once this applicant is <strong>Shortlisted</strong>, at <strong>Interview</strong> or <strong>Accepted</strong>. Only selected applicants are contacted.
      </p>
    );
  }

  const unfilled = [...new Set([...`${subject} ${message}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];

  const log = async (channel: 'whatsapp' | 'email' | 'copy') => {
    setBusy(channel);
    try {
      const result = await call<{ activity: Activity; contacted: boolean; last_contacted_at: string }>(`applications/${app.id}/contact`, {
        body: { channel, template_id: templateId, body: message, subject, by: leadName },
      });
      onContacted({ contacted: true, last_contacted_at: result.last_contacted_at }, result.activity);
      if (channel === 'email') notify(`Email sent to ${app.applicant_email}.`);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    } finally {
      setBusy('');
    }
  };

  const whatsapp = () => {
    // Opened straight from the tap, so phones don't block it as a pop-up.
    openOutside(whatsappLink(app.phone_wa, message));
    log('whatsapp');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      window.prompt('Copy this message', message);
    }
    log('copy');
  };
  const email = () => {
    if (window.confirm(`Send this email to ${app.applicant_email} now?`)) log('email');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {settings.templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplateId(t.id)}
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
      <input aria-label="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} placeholder="Email subject" />
      <textarea
        aria-label="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={8}
        className="w-full rounded-xl border border-slate-300 bg-white p-3 text-[#0B1F3F]"
      />
      {unfilled.length > 0 && (
        <p className="text-sm font-semibold text-amber-700">Fill in: {unfilled.map((p) => ASKED[p] ?? p).join(', ')}{unfilled.includes('groupLink') && ' (set the group link in Templates)'}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="green" onClick={whatsapp} disabled={!!busy || !app.phone_wa || unfilled.length > 0} title={app.phone_wa ? '' : 'Check the phone number'}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </Button>
        <Button onClick={email} disabled={!!busy || !app.applicant_email || unfilled.length > 0 || !subject}>
          <Mail className="h-4 w-4" /> {busy === 'email' ? 'Sending...' : 'Send email'}
        </Button>
        <Button variant="outline" onClick={copy} disabled={!!busy || unfilled.length > 0}>
          <Copy className="h-4 w-4" /> Copy
        </Button>
      </div>
      <p className="text-xs text-slate-500">WhatsApp and Copy are logged as "message opened": the app can't see if it was sent. Email is sent from the hub's address.</p>
    </div>
  );
}
