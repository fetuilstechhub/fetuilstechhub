import { Fragment } from 'react';
import { RUBRIC, STATUSES, day, type Application, type RubricKey } from './api';

export const StatusPill = ({ status }: { status: string }) => {
  const s = STATUSES.find((x) => x.id === status);
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${s?.style ?? 'bg-slate-100'}`}>{s?.label ?? status}</span>;
};

const Tag = ({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'amber' | 'emerald' | 'red' | 'sky' }) => {
  const styles = {
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-900',
    emerald: 'bg-emerald-100 text-emerald-900',
    red: 'bg-red-100 text-red-800',
    sky: 'bg-sky-100 text-sky-900',
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>{children}</span>;
};

export const Badges = ({ app }: { app: Application }) => (
  <span className="flex flex-wrap gap-1">
    {app.returning_intern && <Tag tone="sky">Returning intern</Tag>}
    {app.is_unilorin === false && <Tag tone="amber">Not Unilorin</Tag>}
    {!app.phone_wa && <Tag tone="red">Check phone number</Tag>}
    {app.contacted && <Tag tone="emerald">Message opened {day(app.last_contacted_at)}</Tag>}
    {app.track && <Tag>{app.track === 'innovation' ? 'Innovation' : 'Training'}</Tag>}
  </span>
);

// Plain text with http(s) links made clickable. Everything else stays text.
export const Linked = ({ text }: { text: string }) => {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part.replace(/[).,;:!?]+$/, '')} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-[#E8481C] underline">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
};

export const Answers = ({ app }: { app: Application }) => (
  <dl className="space-y-3">
    {app.answers.map((x, i) => (
      <div key={i}>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{x.q}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap break-words text-[#0B1F3F]">
          <Linked text={x.a} />
        </dd>
      </div>
    ))}
    {!app.answers.length && <p className="text-slate-500">No answers beyond the basics.</p>}
  </dl>
);

export const Facts = ({ app, showPrivate }: { app: Application; showPrivate?: boolean }) => {
  const rows: [string, string][] = [
    ['Applied for', app.role_raw],
    ['Faculty / Department', app.faculty_dept],
    ['Hours per week', app.hours_per_week],
    ['On site', app.available_on_site],
    ...(showPrivate && app.matric_number ? ([['Matric number', app.matric_number]] as [string, string][]) : []),
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
          <dd className="break-words text-[#0B1F3F]">{v}</dd>
        </div>
      ))}
    </dl>
  );
};

export const RubricPicker = ({
  rubric,
  onPick,
  disabled,
}: {
  rubric: Application['rubric'];
  onPick: (key: RubricKey, value: number | null) => void;
  disabled?: boolean;
}) => {
  const total = RUBRIC.every((r) => rubric[r.key]) ? RUBRIC.reduce((s, r) => s + (rubric[r.key] ?? 0), 0) * 4 : null;
  return (
    <div>
      <div className="space-y-2">
        {RUBRIC.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-slate-700">{r.label}</span>
            <span className="flex gap-1" role="radiogroup" aria-label={r.label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rubric[r.key] === n}
                  disabled={disabled}
                  onClick={() => onPick(r.key, rubric[r.key] === n ? null : n)}
                  className={`h-9 w-9 rounded-lg text-sm font-bold ${rubric[r.key] === n ? 'bg-[#0B1F3F] text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
                >
                  {n}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold text-[#0B1F3F]">Score: {total ?? '—'}{total !== null && ' / 100'}</p>
    </div>
  );
};
