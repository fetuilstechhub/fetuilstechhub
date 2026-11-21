import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock, Undo2, X } from 'lucide-react';
import { Button, Card, Empty, inputClass } from '@/components/admin/ui';
import { Answers, Badges, Facts, RubricPicker } from './bits';
import { statusLabel, teamLabel, when, type Application, type Status } from './api';

type Decision = { id: string; name: string; from: Status; to: Status };

// One applicant at a time: decide, and the next one appears. Keys: S, R, L, U.
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Shares the unreviewed applicants evenly between the team's leads.
const SplitForm = ({ count, leadName, onSplit, onCancel }: { count: number; leadName: string; onSplit: (names: string[]) => Promise<void>; onCancel: () => void }) => {
  const [names, setNames] = useState([leadName, '']);
  const [busy, setBusy] = useState(false);
  const clean = names.map((n) => n.trim()).filter(Boolean);
  const distinct = new Set(clean.map((n) => n.toLowerCase())).size === clean.length;
  return (
    <Card className="space-y-3">
      <p className="text-sm text-slate-700">
        Share the <strong>{count}</strong> applicants nobody has reviewed yet between your team's leads, about {clean.length > 1 ? Math.ceil(count / clean.length) : count} each.
        Each lead then taps their name and reviews only their share. Applicants already reviewed stay as they are.
      </p>
      {names.map((n, i) => (
        <input
          key={i}
          aria-label={`Lead ${i + 1}`}
          value={n}
          onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
          placeholder={`Lead ${i + 1} name`}
          className={inputClass}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {names.length < 6 && <Button variant="outline" onClick={() => setNames([...names, ''])}>Add a lead</Button>}
        <Button
          disabled={busy || clean.length < 2 || !distinct || !count}
          onClick={async () => {
            setBusy(true);
            await onSplit(clean);
            setBusy(false);
          }}
        >
          {busy ? 'Splitting...' : `Split ${count} between ${clean.length}`}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
      <p className="text-xs text-slate-500">Use the same names you each typed when you signed in, so "Mine" picks yours automatically.</p>
    </Card>
  );
};

export default function ReviewView({
  apps,
  showPrivate,
  leadName,
  canSplit,
  onSplit,
  patch,
  openDetail,
}: {
  apps: Application[];
  showPrivate: boolean;
  leadName: string;
  canSplit: boolean;
  onSplit: (names: string[]) => Promise<boolean>;
  patch: (id: string, body: Record<string, unknown>) => Promise<Application | null>;
  openDetail: (id: string) => void;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [history, setHistory] = useState<Decision[]>([]);
  const [busy, setBusy] = useState(false);
  const [splitting, setSplitting] = useState(false);

  const names = useMemo(() => [...new Set(apps.map((a) => a.assigned_to).filter(Boolean))].sort(), [apps]);
  // '' means everyone's applicants. Starts on your own share if the list has been split.
  const [who, setWho] = useState(() => names.find((n) => same(n, leadName)) ?? '');
  useEffect(() => {
    if (!who) {
      const mine = names.find((n) => same(n, leadName));
      if (mine) setWho(mine);
    }
    // Only when the split changes, not when someone picks "Everyone".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names.join('|')]);

  const share = useMemo(() => (who ? apps.filter((a) => same(a.assigned_to, who)) : apps), [apps, who]);
  const queue = useMemo(
    () =>
      share
        .filter((a) => a.status === 'new')
        .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at))),
    [share],
  );
  const waiting = queue.filter((a) => !skipped.includes(a.id));
  const current = waiting[0];
  const reviewed = share.length - queue.length;
  const unreviewed = apps.filter((a) => a.status === 'new').length;

  const decide = useCallback(
    async (to: Status) => {
      if (!current || busy) return;
      setBusy(true);
      const done = await patch(current.id, { status: to });
      if (done) setHistory((h) => [{ id: current.id, name: current.applicant_name, from: current.status, to }, ...h].slice(0, 20));
      setBusy(false);
      window.scrollTo({ top: 0 });
    },
    [current, busy, patch],
  );

  const later = useCallback(() => {
    if (current) setSkipped((s) => [...s, current.id]);
    window.scrollTo({ top: 0 });
  }, [current]);

  const undo = useCallback(async () => {
    const [last, ...rest] = history;
    if (!last || busy) return;
    setBusy(true);
    if (await patch(last.id, { status: last.from })) {
      setHistory(rest);
      setSkipped((s) => s.filter((id) => id !== last.id));
    }
    setBusy(false);
  }, [history, busy, patch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const key = e.key.toLowerCase();
      if (key === 's') decide('shortlisted');
      else if (key === 'r') decide('rejected');
      else if (key === 'l') later();
      else if (key === 'u') undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, later, undo]);

  const last = history[0];

  return (
    <div className="space-y-4">
      {(names.length > 0 || canSplit) && (
        <div className="flex flex-wrap items-center gap-2">
          {names.length > 0 && (
            <>
              <span className="text-sm font-semibold text-slate-600">Whose list:</span>
              {['', ...names].map((n) => {
                const left = apps.filter((a) => a.status === 'new' && (!n || same(a.assigned_to, n))).length;
                return (
                  <button
                    key={n || 'everyone'}
                    type="button"
                    onClick={() => {
                      setWho(n);
                      setSkipped([]);
                    }}
                    className={`h-9 rounded-full px-3 text-sm font-semibold ${same(who, n) ? 'bg-[#0B1F3F] text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
                  >
                    {n ? (same(n, leadName) ? `Mine (${n})` : n) : 'Everyone'} · {left}
                  </button>
                );
              })}
            </>
          )}
          {canSplit && !splitting && (
            <button type="button" onClick={() => setSplitting(true)} className="h-9 rounded-full px-3 text-sm font-semibold text-[#E8481C] underline">
              {names.length ? 'Split again' : 'Two or more leads? Split the list'}
            </button>
          )}
        </div>
      )}
      {splitting && (
        <SplitForm
          count={unreviewed}
          leadName={leadName}
          onCancel={() => setSplitting(false)}
          onSplit={async (list) => {
            if (await onSplit(list)) {
              setSplitting(false);
              setWho(list.find((n) => same(n, leadName)) ?? '');
              setSkipped([]);
            }
          }}
        />
      )}

      <div>
        <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
          <span>{reviewed} of {share.length} reviewed{who ? ` (${same(who, leadName) ? 'your share' : `${who}'s share`})` : ''}</span>
          <span>{queue.length} new left</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${share.length ? (reviewed / share.length) * 100 : 0}%` }} />
        </div>
      </div>

      {last && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-white">
          <span className="min-w-0 truncate">{last.name}: {statusLabel(last.to)}</span>
          <button type="button" onClick={undo} disabled={busy} className="flex flex-shrink-0 items-center gap-1 font-semibold underline">
            <Undo2 className="h-4 w-4" /> Undo (U)
          </button>
        </div>
      )}

      {!current ? (
        <Card>
          <Empty>
            {skipped.length ? (
              <>
                {skipped.length} left for later.{' '}
                <button type="button" className="font-semibold text-[#E8481C] underline" onClick={() => setSkipped([])}>
                  Review them now
                </button>
              </>
            ) : (
              'All caught up. Nobody new to review here.'
            )}
          </Empty>
        </Card>
      ) : (
        <>
          <Card className="space-y-4">
            <div>
              <h2 className="break-words text-2xl font-extrabold text-[#0B1F3F]">{current.applicant_name}</h2>
              <p className="text-sm text-slate-500">
                {teamLabel(current.team)} · applied {when(current.submitted_at)}
              </p>
              <div className="mt-2"><Badges app={current} /></div>
            </div>
            <Facts app={current} showPrivate={showPrivate} />
            <Answers app={current} />
            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-2 font-bold text-[#0B1F3F]">Score (optional)</h3>
              <RubricPicker rubric={current.rubric} onPick={(key, value) => patch(current.id, { rubric: { [key]: value } })} />
            </div>
            <button type="button" onClick={() => openDetail(current.id)} className="text-sm font-semibold text-[#E8481C] underline">
              Open full profile and notes
            </button>
          </Card>

          {/* Sticky so the decision buttons are always under the thumb on a phone. */}
          <div className="sticky bottom-0 -mx-4 grid grid-cols-3 gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
            <button type="button" disabled={busy} onClick={() => decide('rejected')} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white font-bold text-red-700 disabled:opacity-60">
              <X className="h-5 w-5" /> Reject <kbd className="hidden text-xs opacity-60 sm:inline">R</kbd>
            </button>
            <button type="button" disabled={busy} onClick={later} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-700 disabled:opacity-60">
              <Clock className="h-5 w-5" /> Later <kbd className="hidden text-xs opacity-60 sm:inline">L</kbd>
            </button>
            <button type="button" disabled={busy} onClick={() => decide('shortlisted')} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white disabled:opacity-60">
              <Check className="h-5 w-5" /> Shortlist <kbd className="hidden text-xs opacity-70 sm:inline">S</kbd>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
