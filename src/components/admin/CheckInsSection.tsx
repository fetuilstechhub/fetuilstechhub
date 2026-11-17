import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { clock, downloadCsv, lagosToday, shortDate, SignedOut, type AdminCall } from '@/lib/admin';
import { Button, Card, Empty, SectionTitle, Spinner, inputClass, type Notify } from './ui';

type Entry = { at: string; holder: string; plan_title: string; code: string };

const CheckInsSection = ({ call, notify }: { call: AdminCall; notify: Notify }) => {
  const [date, setDate] = useState(lagosToday());
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    setEntries(null);
    call<{ entries: Entry[] }>(`check-ins?date=${date}`)
      .then((body) => setEntries(body.entries))
      .catch((err) => {
        if (!(err instanceof SignedOut)) notify(err.message, false);
        setEntries([]);
      });
  }, [call, date, notify]);

  const people = new Set((entries ?? []).map((e) => e.code)).size;

  return (
    <div>
      <SectionTitle
        title="Check-ins"
        action={
          <Button
            variant="outline"
            disabled={!entries?.length}
            onClick={() => downloadCsv(`fetuils-check-ins-${date}.csv`, [['Time', 'Name', 'Plan', 'Code'], ...(entries ?? []).map((e) => [clock(e.at), e.holder, e.plan_title, e.code])])}
          >
            <Download className="h-4 w-4" /> Spreadsheet
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Day" type="date" value={date} max={lagosToday()} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${inputClass} max-w-[220px]`} />
        {entries && <span className="text-sm text-slate-600"><strong className="text-[#0B1F3F]">{entries.length}</strong> entries from <strong className="text-[#0B1F3F]">{people}</strong> {people === 1 ? 'pass' : 'passes'} on {shortDate(date)}</span>}
      </div>
      {!entries ? (
        <Spinner />
      ) : entries.length ? (
        <Card className="mt-3 p-0 sm:p-0">
          <ul className="divide-y divide-slate-100">
            {entries.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#0B1F3F]">{e.holder}</div>
                  <div className="truncate text-sm text-slate-500">{e.plan_title} · <span className="font-mono">{e.code}</span></div>
                </div>
                <div className="flex-shrink-0 font-mono text-sm text-slate-700">{clock(e.at)}</div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty>No one checked in on this day.</Empty>
      )}
    </div>
  );
};

export default CheckInsSection;
