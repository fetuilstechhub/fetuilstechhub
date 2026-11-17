import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, Copy, Download, Plus, Trash2, Users, X } from 'lucide-react';
import { copyText, downloadCsv, lagosToday, naira, setupLink, SignedOut, type AdminCall } from '@/lib/admin';
import { eventDate, eventLink, eventTime, type PublicEvent } from '@/lib/events';
import { eventItems } from '@/lib/plans';
import { Button, Card, Empty, Field, SectionTitle, Spinner, inputClass, type Notify } from './ui';

type AdminEvent = PublicEvent & { id: string; organiser_email: string; reference: string | null; guests: number };
type Guest = { name: string; email: string; registered_at: string };

type AnyGuest = Guest & { event_title: string; event_starts_at: string | null };

const HALL_PRICE = eventItems[0].price;

// Every attendee across every event, with search and a spreadsheet download.
const AllAttendees = ({ call, notify }: { call: AdminCall; notify: Notify }) => {
  const [guests, setGuests] = useState<AnyGuest[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    call<{ guests: AnyGuest[] }>('guests')
      .then((body) => setGuests(body.guests))
      .catch((err) => {
        if (!(err instanceof SignedOut)) notify(err.message, false);
        setGuests([]);
      });
  }, [call, notify]);

  if (!guests) return <Spinner />;
  const query = search.trim().toLowerCase();
  const shown = guests.filter((g) => !query || [g.name, g.email, g.event_title].some((v) => v.toLowerCase().includes(query)));
  const people = new Set(guests.map((g) => g.email)).size;

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          <strong className="text-[#0B1F3F]">{guests.length}</strong> registrations from <strong className="text-[#0B1F3F]">{people}</strong> people across all events
        </p>
        <Button
          variant="outline"
          disabled={!shown.length}
          onClick={() => downloadCsv(`fetuils-attendees-${lagosToday()}.csv`, [
            ['Name', 'Email', 'Event', 'Event date', 'Registered'],
            ...shown.map((g) => [g.name, g.email, g.event_title, g.event_starts_at ? eventDate(g.event_starts_at) : '', g.registered_at]),
          ])}
        >
          <Download className="h-4 w-4" /> Spreadsheet
        </Button>
      </div>
      <input aria-label="Search attendees" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or event" className={`${inputClass} mt-3`} />
      {shown.length ? (
        <ul className="mt-3 max-h-[60vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {shown.map((g, i) => (
            <li key={`${g.email}-${g.event_title}-${i}`} className="flex flex-wrap items-start justify-between gap-x-3 p-3">
              <div className="min-w-0">
                <div className="break-words font-semibold text-[#0B1F3F]">{g.name}</div>
                <div className="break-all text-sm text-slate-500">{g.email}</div>
              </div>
              <div className="text-sm text-slate-600">{g.event_title}</div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{query ? 'No attendee matches your search.' : 'No one has registered for an event yet.'}</Empty>
      )}
    </Card>
  );
};

const AddEvent = ({ call, notify, onDone }: { call: AdminCall; notify: Notify; onDone: (slug: string) => void }) => {
  const [organiserName, setOrganiserName] = useState('');
  const [organiserEmail, setOrganiserEmail] = useState('');
  const [date, setDate] = useState(lagosToday());
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const paid = amount === '' ? HALL_PRICE : Number(amount);
    if (!window.confirm(`Has ${organiserName} paid ${naira(paid)}? Their pass will be emailed and the event page goes live.`)) return;
    setBusy(true);
    try {
      const body = await call<{ event: AdminEvent; email_sent: boolean }>('events', {
        body: {
          organiser_name: organiserName, organiser_email: organiserEmail, date, title, start_time: startTime, description,
          amount: amount === '' ? undefined : Number(amount),
        },
      });
      const link = eventLink(body.event.slug);
      await copyText(link);
      notify(
        body.email_sent
          ? `Event created. The link is copied, ready to send: ${link}`
          : `Event created and the link is copied: ${link}. The organiser's email failed, so send them the link on WhatsApp.`,
        body.email_sent,
      );
      onDone(body.event.slug);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4">
      <p className="mb-4 text-sm text-slate-600">For organisers who have already paid. This records their payment, emails their pass and creates the event page in one step.</p>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Organiser's name"><input value={organiserName} onChange={(e) => setOrganiserName(e.target.value)} className={inputClass} required /></Field>
        <Field label="Organiser's email"><input type="email" value={organiserEmail} onChange={(e) => setOrganiserEmail(e.target.value)} className={inputClass} required /></Field>
        <Field label="Event name"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} required /></Field>
        <Field label="Amount paid (₦)" hint={`Leave empty for ${naira(HALL_PRICE)}.`}>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder={String(HALL_PRICE)} className={inputClass} />
        </Field>
        <Field label="Event date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required /></Field>
        <Field label="Start time" hint="Registration closes 2 hours after this.">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} required />
        </Field>
        <Field label="About the event (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-xl border border-slate-300 p-3 sm:col-span-2" />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating...' : 'Create event'}</Button>
        </div>
      </form>
    </Card>
  );
};

const EventCard = ({ event, call, notify, reload }: { event: AdminEvent; call: AdminCall; notify: Notify; reload: () => void }) => {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    try {
      setGuests((await call<{ guests: Guest[] }>(`events/${event.id}/guests`)).guests);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
      setOpen(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Take down "${event.title}"? The page stops working and its ${event.guests} registrations are deleted. This cannot be undone.`)) return;
    try {
      await call(`events/${event.id}`, { method: 'DELETE' });
      notify('Event page taken down.');
      reload();
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    }
  };

  const query = search.trim().toLowerCase();
  const shown = (guests ?? []).filter((g) => !query || g.name.toLowerCase().includes(query) || g.email.includes(query));

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-lg font-bold text-[#0B1F3F]">{event.title}</div>
          <div className="text-sm text-slate-600">{eventDate(event.starts_at)}, {eventTime(event.starts_at)}</div>
          <div className="break-all text-sm text-slate-500">By {event.organiser} · {event.organiser_email}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-extrabold text-[#0B1F3F]">{event.guests}</div>
          <div className="text-xs text-slate-500">registered</div>
        </div>
      </div>
      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${event.open ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'}`}>
        {event.open ? 'Registration open' : 'Registration closed'}
      </span>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={async () => { if (await copyText(eventLink(event.slug))) notify('Event link copied.'); }}><Copy className="h-4 w-4" /> Event link</Button>
        {event.reference && (
          <Button variant="outline" onClick={async () => { if (await copyText(setupLink(event.reference!))) notify('Setup link copied. Only send it to the organiser.'); }}>
            <Copy className="h-4 w-4" /> Setup link
          </Button>
        )}
        <Button onClick={toggle}>Guest list <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /></Button>
        <Button variant="danger" onClick={remove}><Trash2 className="h-4 w-4" /> Take down</Button>
      </div>
      {open && (
        <div className="mt-3">
          {!guests ? (
            <Spinner />
          ) : guests.length ? (
            <>
              <div className="flex gap-2">
                <input aria-label="Search guests" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest name or email" className={inputClass} />
                <Button
                  variant="outline"
                  onClick={() => downloadCsv(`${event.slug}-guests.csv`, [['Name', 'Email', 'Registered'], ...guests.map((g) => [g.name, g.email, g.registered_at])])}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
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
    </Card>
  );
};

const EventsSection = ({ call, notify }: { call: AdminCall; notify: Notify }) => {
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents((await call<{ events: AdminEvent[] }>('events')).events);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
      setEvents([]);
    }
  }, [call, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <SectionTitle
        title="Events"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowAll((v) => !v)}><Users className="h-4 w-4" /> {showAll ? 'Hide attendees' : 'All attendees'}</Button>
            <Button onClick={() => setAdding((v) => !v)}>{adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {adding ? 'Close' : 'Add event'}</Button>
          </div>
        }
      />
      {showAll && <AllAttendees call={call} notify={notify} />}
      {adding && <AddEvent call={call} notify={notify} onDone={() => { setAdding(false); void load(); }} />}
      {!events ? (
        <Spinner />
      ) : events.length ? (
        <>
        <p className="mb-3 text-sm text-slate-600">
          <strong className="text-[#0B1F3F]">{events.length}</strong> {events.length === 1 ? 'event' : 'events'} ·{' '}
          <strong className="text-[#0B1F3F]">{events.filter((e) => e.open).length}</strong> open for registration ·{' '}
          <strong className="text-[#0B1F3F]">{events.reduce((t, e) => t + e.guests, 0)}</strong> registrations in total
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {events.map((e) => <EventCard key={e.id} event={e} call={call} notify={notify} reload={() => void load()} />)}
        </div>
        </>
      ) : (
        <Empty>No events yet. Use Add event for organisers who have paid.</Empty>
      )}
    </div>
  );
};

export default EventsSection;
