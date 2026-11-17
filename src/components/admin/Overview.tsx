import { useEffect, useState } from 'react';
import { naira, shortDate, SignedOut, type AdminCall } from '@/lib/admin';
import { eventDate, eventTime } from '@/lib/events';
import { Card, SectionTitle, Spinner, type Notify } from './ui';

type OverviewData = {
  today: string;
  revenue: { today: number; week: number; month: number; month_payments: number };
  by_plan: { plan: string; count: number; amount: number }[];
  daily: { day: string; amount: number; count: number }[];
  waiting_payments: number;
  check_ins_today: number;
  active_passes: number;
  upcoming_events: { id: string; title: string; starts_at: string; guests: number; organiser: string }[];
};

const Tile = ({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) => {
  const body = (
    <>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-extrabold tracking-tight text-[#0B1F3F]">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 sm:p-5">
      {body}
    </button>
  ) : (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">{body}</div>
  );
};

const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });

// One series, one colour: money received per day. Hover or tap a bar for its value.
const DailyChart = ({ daily }: { daily: OverviewData['daily'] }) => {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(...daily.map((d) => d.amount), 1);
  const shown = active === null ? null : daily[active];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-[#0B1F3F]">Money received, last 14 days</h3>
          <p className="h-5 text-sm text-slate-600">
            {shown ? `${dayLabel(shown.day)}: ${naira(shown.amount)} from ${shown.count} ${shown.count === 1 ? 'payment' : 'payments'}` : 'Hover or tap a bar'}
          </p>
        </div>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="text-sm font-semibold text-primary">
          {showTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {showTable ? (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {[...daily].reverse().map((d) => (
              <tr key={d.day} className="border-t border-slate-100">
                <td className="py-1.5 text-slate-600">{dayLabel(d.day)}</td>
                <td className="py-1.5 text-right text-slate-600">{d.count}</td>
                <td className="py-1.5 text-right font-semibold text-[#0B1F3F]">{naira(d.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="mt-4 flex h-40 items-end gap-[2px] border-b border-slate-200" onMouseLeave={() => setActive(null)}>
            {daily.map((d, i) => (
              <button
                key={d.day}
                type="button"
                aria-label={`${dayLabel(d.day)}: ${naira(d.amount)}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className="group flex h-full flex-1 items-end"
              >
                <span
                  className={`block w-full rounded-t-[4px] ${active === i ? 'bg-[#0B1F3F]' : 'bg-primary'}`}
                  style={{ height: d.amount ? `${Math.max(3, (d.amount / max) * 100)}%` : '0%' }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>{dayLabel(daily[0].day)}</span>
            <span>Today</span>
          </div>
        </>
      )}
    </Card>
  );
};

const Overview = ({ call, notify, go }: { call: AdminCall; notify: Notify; go: (section: string) => void }) => {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    call<OverviewData>('overview')
      .then(setData)
      .catch((err) => !(err instanceof SignedOut) && notify(err.message, false));
  }, [call, notify]);

  if (!data) return <Spinner />;
  const { revenue } = data;

  return (
    <div>
      <SectionTitle title="Overview" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Received today" value={naira(revenue.today)} />
        <Tile label="This week" value={naira(revenue.week)} sub="Since Monday" />
        <Tile label="This month" value={naira(revenue.month)} sub={`${revenue.month_payments} payments`} />
        <Tile label="Waiting for payment" value={String(data.waiting_payments)} sub="Tap to confirm" onClick={() => go('payments')} />
        <Tile label="Check-ins today" value={String(data.check_ins_today)} onClick={() => go('check-ins')} />
        <Tile label="Active passes" value={String(data.active_passes)} sub="Valid today" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <DailyChart daily={data.daily} />
        <Card>
          <h3 className="font-bold text-[#0B1F3F]">This month by plan</h3>
          {data.by_plan.length ? (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-semibold">Plan</th>
                  <th className="pb-2 text-right font-semibold">Sold</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.by_plan.map((p) => (
                  <tr key={p.plan} className="border-t border-slate-100">
                    <td className="py-2 text-[#0B1F3F]">{p.plan}</td>
                    <td className="py-2 text-right text-slate-600">{p.count}</td>
                    <td className="py-2 text-right font-semibold text-[#0B1F3F]">{naira(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No payments yet this month.</p>
          )}
        </Card>
      </div>

      <Card className="mt-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#0B1F3F]">Upcoming events</h3>
          <button type="button" onClick={() => go('events')} className="text-sm font-semibold text-primary">All events</button>
        </div>
        {data.upcoming_events.length ? (
          <ul className="mt-2 divide-y divide-slate-100">
            {data.upcoming_events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#0B1F3F]">{e.title}</div>
                  <div className="text-sm text-slate-500">{eventDate(e.starts_at)}, {eventTime(e.starts_at)} · {e.organiser}</div>
                </div>
                <div className="flex-shrink-0 text-right text-sm text-slate-600"><span className="font-bold text-[#0B1F3F]">{e.guests}</span> registered</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No upcoming events.</p>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">Figures for {shortDate(data.today)}. Money is counted on the day the payment was confirmed.</p>
    </div>
  );
};

export default Overview;
