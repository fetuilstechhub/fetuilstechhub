import { useMemo, useState } from 'react';
import { ChevronRight, Undo2 } from 'lucide-react';
import { Card, Empty, type Notify } from '@/components/admin/ui';
import { Badges, StatusPill } from './bits';
import ContactBox, { type Asked } from './ContactBox';
import { CONTACTABLE, SignedOut, statusLabel, teamLabel, type Activity, type Application, type Call, type Login, type Settings, type Status } from './api';

// Steps through selected applicants who haven't been messaged yet, one at a time.
export default function ContactQueue({
  apps,
  login,
  leadName,
  settings,
  call,
  notify,
  replace,
  asked,
  setAsked,
  openDetail,
}: {
  apps: Application[];
  login: Login;
  leadName: string;
  settings: Settings;
  call: Call;
  notify: Notify;
  replace: (id: string, change: Partial<Application>) => void;
  asked: Asked;
  setAsked: (a: Asked) => void;
  openDetail: (id: string) => void;
}) {
  const [status, setStatus] = useState<Status>('shortlisted');
  const [skipped, setSkipped] = useState<string[]>([]);
  const [last, setLast] = useState<{ app: Application; entry: Activity } | null>(null);

  const waiting = useMemo(
    () => apps.filter((a) => a.status === status && !a.contacted).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    [apps, status],
  );
  const queue = waiting.filter((a) => !skipped.includes(a.id));
  const current = queue[0];

  const undo = async () => {
    if (!last) return;
    try {
      const contact = await call<Partial<Application>>(`activity/${last.entry.id}/undo`, { body: {} });
      replace(last.app.id, contact);
      setLast(null);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {CONTACTABLE.map((s) => {
          const n = apps.filter((a) => a.status === s && !a.contacted).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setSkipped([]);
              }}
              className={`h-10 flex-shrink-0 rounded-full px-4 text-sm font-semibold ${status === s ? 'bg-[#0B1F3F] text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
            >
              {statusLabel(s)}: {n} to message
            </button>
          );
        })}
      </div>

      {last && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-white">
          <span className="min-w-0 truncate">
            {last.app.applicant_name}: {last.entry.channel === 'email' ? 'email sent' : 'message opened'}
          </span>
          {last.entry.channel !== 'email' && (
            <button type="button" onClick={undo} className="flex flex-shrink-0 items-center gap-1 font-semibold underline">
              <Undo2 className="h-4 w-4" /> Not sent? Undo
            </button>
          )}
        </div>
      )}

      {!current ? (
        <Card>
          <Empty>
            {skipped.length ? (
              <>
                {skipped.length} skipped.{' '}
                <button type="button" className="font-semibold text-[#E8481C] underline" onClick={() => setSkipped([])}>Go through them again</button>
              </>
            ) : (
              `Everyone ${statusLabel(status).toLowerCase()} here has been messaged.`
            )}
          </Empty>
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{queue.length} left</p>
              <h2 className="break-words text-xl font-extrabold text-[#0B1F3F]">{current.applicant_name}</h2>
              <p className="break-all text-sm text-slate-500">{teamLabel(current.team)} · {current.phone || 'no phone'} · {current.applicant_email || 'no email'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusPill status={current.status} />
                {current.score !== null && <span className="text-sm font-bold">{current.score}/100</span>}
                <Badges app={current} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openDetail(current.id)} className="h-10 rounded-xl px-3 text-sm font-semibold text-[#E8481C] underline">Profile</button>
              <button type="button" onClick={() => setSkipped((s) => [...s, current.id])} className="flex h-10 items-center gap-1 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-600">
                Skip <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ContactBox
            app={current}
            settings={settings}
            leadName={leadName}
            leadTeam={login.label}
            call={call}
            notify={notify}
            asked={asked}
            setAsked={setAsked}
            onContacted={(contact, entry) => {
              setLast({ app: current, entry });
              replace(current.id, contact);
            }}
          />
        </Card>
      )}
    </div>
  );
}
