import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { downloadCsv } from '@/lib/admin';
import { Button, Card, Empty, inputClass } from '@/components/admin/ui';
import { Badges, StatusPill } from './bits';
import { HOURS, ON_SITE, STATUSES, day, statusLabel, teamLabel, type Application } from './api';

type Sort = 'oldest' | 'newest' | 'score' | 'name';
const PAGE = 50;

export default function ListView({
  apps,
  showTeam,
  showPrivate,
  scopeName,
  openDetail,
}: {
  apps: Application[];
  showTeam: boolean;
  showPrivate: boolean;
  scopeName: string;
  openDetail: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [hours, setHours] = useState('');
  const [onSite, setOnSite] = useState('');
  const [flag, setFlag] = useState('');
  const [sort, setSort] = useState<Sort>('oldest');
  const [shown, setShown] = useState(PAGE);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s.id, apps.filter((a) => a.status === s.id).length])), [apps]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = apps.filter((a) => {
      if (status && a.status !== status) return false;
      if (hours && a.hours_bucket !== hours) return false;
      if (onSite && a.on_site_bucket !== onSite) return false;
      if (flag === 'returning' && !a.returning) return false;
      if (flag === 'contacted' && !a.contacted) return false;
      if (flag === 'not-contacted' && a.contacted) return false;
      if (flag === 'not-unilorin' && a.is_unilorin !== false) return false;
      if (flag === 'phone' && a.phone_wa) return false;
      if (flag === 'scored' && a.score === null) return false;
      if (!q) return true;
      return [a.applicant_name, a.applicant_email, a.faculty_dept, a.skills, a.role_raw].some((v) => v.toLowerCase().includes(q));
    });
    const by: Record<Sort, (a: Application, b: Application) => number> = {
      oldest: (a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)),
      newest: (a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)),
      score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
      name: (a, b) => a.applicant_name.localeCompare(b.applicant_name),
    };
    return out.sort(by[sort]);
  }, [apps, query, status, hours, onSite, flag, sort]);

  const exportCsv = () =>
    downloadCsv(`selection-${scopeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, [
      ['Name', 'Team', 'Status', 'Score', 'Email', 'Phone', 'Faculty/Department', ...(showPrivate ? ['Matric'] : []), 'Hours', 'On site', 'Returning', 'Contacted', 'Applied'],
      ...list.map((a) => [
        a.applicant_name, teamLabel(a.team), statusLabel(a.status), a.score ?? '', a.applicant_email, a.phone, a.faculty_dept,
        ...(showPrivate ? [a.matric_number ?? ''] : []), a.hours_per_week, a.available_on_site, a.returning ? 'Yes' : 'No',
        a.contacted ? 'Yes' : 'No', a.submitted_at ?? '',
      ]),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatus('')}
          className={`rounded-xl px-3 py-2 text-left ${status === '' ? 'bg-[#0B1F3F] text-white' : 'border border-slate-200 bg-white text-[#0B1F3F]'}`}
        >
          <div className="text-xl font-extrabold">{apps.length}</div>
          <div className="text-xs font-semibold opacity-80">All</div>
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(status === s.id ? '' : s.id)}
            className={`rounded-xl px-3 py-2 text-left ${status === s.id ? 'bg-[#0B1F3F] text-white' : 'border border-slate-200 bg-white text-[#0B1F3F]'}`}
          >
            <div className="text-xl font-extrabold">{counts[s.id]}</div>
            <div className="text-xs font-semibold opacity-80">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, department, skills" aria-label="Search" className={`${inputClass} pl-10`} />
        </label>
        <select aria-label="Hours" value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass}>
          <option value="">Any hours</option>
          {Object.entries(HOURS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="On site" value={onSite} onChange={(e) => setOnSite(e.target.value)} className={inputClass}>
          <option value="">Any on-site</option>
          {Object.entries(ON_SITE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="More filters" value={flag} onChange={(e) => setFlag(e.target.value)} className={inputClass}>
          <option value="">Everyone</option>
          <option value="returning">Returning interns</option>
          <option value="not-contacted">Not contacted yet</option>
          <option value="contacted">Contacted</option>
          <option value="scored">Scored</option>
          <option value="not-unilorin">Not Unilorin</option>
          <option value="phone">Phone needs checking</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-slate-600">{list.length} shown</span>
        <div className="flex gap-2">
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${inputClass} w-auto`}>
            <option value="oldest">Applied first</option>
            <option value="newest">Applied last</option>
            <option value="score">Highest score</option>
            <option value="name">Name</option>
          </select>
          <Button variant="outline" onClick={exportCsv} disabled={!list.length}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <Card className="p-0 sm:p-0">
        {!list.length ? (
          <Empty>No applicants match.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.slice(0, shown).map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => openDetail(a.id)} className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-slate-50 sm:p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-bold text-[#0B1F3F]">{a.applicant_name}</span>
                      <StatusPill status={a.status} />
                      {a.score !== null && <span className="text-sm font-bold text-[#0B1F3F]">{a.score}</span>}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-slate-500">
                      {[showTeam && teamLabel(a.team), a.faculty_dept, HOURS[a.hours_bucket], ON_SITE[a.on_site_bucket]].filter(Boolean).join(' · ')}
                    </div>
                    <div className="mt-1"><Badges app={a} /></div>
                  </div>
                  <span className="text-xs text-slate-400">{day(a.updated_at ?? a.submitted_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {list.length > shown && (
        <Button variant="outline" className="w-full" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({list.length - shown} left)
        </Button>
      )}
    </div>
  );
}
