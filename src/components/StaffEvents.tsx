import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Copy, Loader2 } from 'lucide-react';
import { eventDate, eventLink, eventTime, type PublicEvent } from '@/lib/events';

type StaffEvent = PublicEvent & { id: string; organiser_email: string; guests: number };
type Guest = { name: string; email: string; registered_at: string };

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy this', text);
    return false;
  }
};

const EventCard = ({ event, call, onNotice }: { event: StaffEvent; call: (path: string) => Promise<unknown>; onNotice: (text: string) => void }) => {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    setBusy(true);
    try {
      const body = (await call(`events/${event.id}/guests`)) as { guests: Guest[] };
      setGuests(body.guests);
    } catch {
      onNotice('Could not load the guest list. Check the internet and try again.');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const query = search.trim().toLowerCase();
  const shown = (guests ?? []).filter((g) => !query || g.name.toLowerCase().includes(query) || g.email.includes(query));

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-lg font-bold text-[#0B1F3F]">{event.title}</div>
          <div className="text-sm text-slate-600">{eventDate(event.starts_at)}, {eventTime(event.starts_at)}</div>
          <div className="break-all text-sm text-slate-500">By {event.organiser} · {event.organiser_email}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-extrabold text-[#0B1F3F]">{event.guests}</div>
          <div className="text-xs text-slate-500">{event.guests === 1 ? 'guest' : 'guests'}</div>
        </div>
      </div>
      <div className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${event.open ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'}`}>
        {event.open ? 'Registration open' : 'Registration closed'}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={async () => { if (await copyText(eventLink(event.slug))) onNotice(`Link to ${event.title} copied.`); }}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 font-semibold text-slate-700"
        >
          <Copy className="h-4 w-4" /> Copy link
        </button>
        <button type="button" onClick={toggle} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B1F3F] font-semibold text-white">
          Guest list <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="mt-3">
          {busy ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          ) : guests && guests.length ? (
            <>
              <input
                aria-label="Search guests"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guest name or email"
                className="h-11 w-full rounded-xl border border-slate-300 px-3"
              />
              <ol className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {shown.map((g) => (
                  <li key={g.email} className="p-3">
                    <div className="break-words font-semibold text-[#0B1F3F]">{g.name}</div>
                    <div className="break-all text-sm text-slate-500">{g.email}</div>
                  </li>
                ))}
              </ol>
              {!shown.length && <p className="mt-2 text-center text-sm text-slate-500">No guest matches your search.</p>}
            </>
          ) : (
            <p className="text-center text-sm text-slate-500">No one has registered yet.</p>
          )}
        </div>
      )}
    </li>
  );
};

const StaffEvents = ({ call, onNotice }: { call: (path: string) => Promise<unknown>; onNotice: (text: string) => void }) => {
  const [events, setEvents] = useState<StaffEvent[] | null>(null);

  const load = useCallback(async () => {
    try {
      const body = (await call('events')) as { events: StaffEvent[] };
      setEvents(body.events);
    } catch {
      onNotice('Could not load events. Check the internet and refresh.');
      setEvents([]);
    }
  }, [call, onNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!events) return <Loader2 className="mx-auto mt-8 h-8 w-8 animate-spin text-slate-400" />;
  if (!events.length) {
    return <p className="mt-8 text-center text-slate-500">No event pages yet. Organisers set one up from their pass email.</p>;
  }
  return (
    <ul className="mt-3 space-y-3">
      {events.map((event) => <EventCard key={event.id} event={event} call={call} onNotice={onNotice} />)}
    </ul>
  );
};

export default StaffEvents;
