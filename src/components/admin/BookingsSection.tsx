import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Download, Plus, X } from 'lucide-react';
import { workspacePlans, eventItems, rentalItems } from '@/lib/plans';
import {
  copyText, dateTime, downloadCsv, lagosToday, naira, passLink, setupLink, shortDate, SignedOut, type AdminCall, type Booking,
} from '@/lib/admin';
import { Button, Card, Empty, Field, SectionTitle, Spinner, StatusBadge, inputClass, type Notify } from './ui';

const PLANS = [...workspacePlans, ...eventItems, ...rentalItems];

const AddBooking = ({ call, notify, onDone }: { call: AdminCall; notify: Notify; onDone: () => void }) => {
  const [planId, setPlanId] = useState(PLANS[0].id);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState(lagosToday());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paid, setPaid] = useState(true);
  const [busy, setBusy] = useState(false);
  const plan = PLANS.find((p) => p.id === planId)!;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (paid && !window.confirm(`Confirm ${naira(amount === '' ? plan.price : Number(amount))} from ${fullName} is in the bank account? Their pass will be emailed now.`)) return;
    setBusy(true);
    try {
      const body = await call<{ booking: Booking; email_sent: boolean }>('bookings', {
        body: { plan_id: planId, full_name: fullName, email, date, notes, paid, amount: amount === '' ? undefined : Number(amount) },
      });
      notify(
        paid
          ? body.email_sent ? `Booking added and pass emailed to ${body.booking.email}.` : `Booking added, but the email failed. Copy the pass link below and send it on WhatsApp.`
          : 'Booking added. It is waiting for payment.',
        !paid || body.email_sent,
      );
      onDone();
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan">
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
            {PLANS.map((p) => <option key={p.id} value={p.id}>{p.title} ({naira(p.price)})</option>)}
          </select>
        </Field>
        <Field label="Start date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required /></Field>
        <Field label="Full name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} required /></Field>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required /></Field>
        <Field label="Amount received (₦)" hint={`Leave empty for the full price, ${naira(plan.price)}. Use it for discounts such as FET 10%.`}>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className={inputClass} placeholder={String(plan.price)} />
        </Field>
        <Field label="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></Field>
        <label className="flex items-center gap-2 text-sm font-medium text-[#0B1F3F] sm:col-span-2">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-5 w-5" />
          Already paid: email their pass now
        </label>
        <Button type="submit" disabled={busy} className="sm:col-span-2">{busy ? 'Saving...' : 'Add booking'}</Button>
      </form>
    </Card>
  );
};

const BookingCard = ({ booking, call, notify, reload }: { booking: Booking; call: AdminCall; notify: Notify; reload: () => void }) => {
  const run = async (path: string, done: (body: { email_sent?: boolean }) => void) => {
    try {
      done(await call(path, { body: { reference: booking.reference } }));
      reload();
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words font-bold text-[#0B1F3F]">{booking.holder}</div>
          <div className="font-mono text-xs text-slate-500">{booking.code}</div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-extrabold text-[#0B1F3F]">{naira(booking.amount)}</div>
          <StatusBadge status={booking.status} />
        </div>
      </div>
      <div className="mt-2 space-y-0.5 text-sm text-slate-600">
        <div>
          {booking.plan_title}
          {booking.starts_on ? `, ${shortDate(booking.starts_on)}` : ''}
          {booking.valid_until && booking.valid_until !== booking.starts_on ? ` to ${shortDate(booking.valid_until)}` : ''}
        </div>
        <div className="break-all">{booking.email}</div>
        <div className="text-slate-400">
          Booked {dateTime(booking.booked_at)}
          {booking.paid_at ? ` · Paid ${dateTime(booking.paid_at)}${booking.payment_method ? ` by ${booking.payment_method}` : ''}` : ''}
          {booking.source === 'admin' ? ' · Added by staff' : ''}
        </div>
        {booking.notes && <div className="break-words rounded-lg bg-slate-50 p-2">{booking.notes}</div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {booking.status === 'paid' && (
          <>
            <Button variant="outline" onClick={async () => { if (await copyText(passLink(booking.reference))) notify('Pass link copied. Paste it in WhatsApp.'); }}>
              <Copy className="h-4 w-4" /> Pass link
            </Button>
            <Button variant="outline" onClick={() => run('bookings/resend', (b) => notify(b.email_sent ? `Pass emailed again to ${booking.email}.` : 'The email failed. Copy the pass link instead.', !!b.email_sent))}>
              Resend pass
            </Button>
            {booking.plan_id === 'event_hall' && (
              <Button variant="outline" onClick={async () => { if (await copyText(setupLink(booking.reference))) notify('Event setup link copied. Only send it to the organiser.'); }}>
                <Copy className="h-4 w-4" /> Event setup link
              </Button>
            )}
          </>
        )}
        {booking.status === 'pending' && (
          <Button
            variant="danger"
            onClick={() => window.confirm(`Cancel ${booking.holder}'s unpaid booking?`) && run('bookings/cancel', () => notify('Booking cancelled.'))}
          >
            <X className="h-4 w-4" /> Cancel booking
          </Button>
        )}
      </div>
    </Card>
  );
};

const BookingsSection = ({ call, notify }: { call: AdminCall; notify: Notify }) => {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [status, setStatus] = useState('paid');
  const [plan, setPlan] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setBookings(null);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (plan) params.set('plan', plan);
    try {
      setBookings((await call<{ bookings: Booking[] }>(`bookings?${params}`)).bookings);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
      setBookings([]);
    }
  }, [call, notify, plan, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const shown = (bookings ?? []).filter((b) => !query || [b.holder, b.code, b.email].some((v) => v.toLowerCase().includes(query)));

  const exportCsv = () =>
    downloadCsv(`fetuils-bookings-${lagosToday()}.csv`, [
      ['Name', 'Email', 'Code', 'Plan', 'Amount', 'Status', 'Start', 'Ends', 'Booked', 'Paid', 'Method', 'Notes'],
      ...shown.map((b) => [b.holder, b.email, b.code, b.plan_title, b.amount, b.status, b.starts_on ?? '', b.valid_until ?? '', b.booked_at, b.paid_at ?? '', b.payment_method ?? '', b.notes]),
    ]);

  return (
    <div>
      <SectionTitle
        title="Bookings"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!shown.length}><Download className="h-4 w-4" /> Spreadsheet</Button>
            <Button onClick={() => setAdding((v) => !v)}>{adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {adding ? 'Close' : 'Add booking'}</Button>
          </div>
        }
      />
      {adding && <AddBooking call={call} notify={notify} onDone={() => { setAdding(false); setStatus(''); void load(); }} />}
      <div className="grid gap-2 sm:grid-cols-3">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Waiting for payment</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>
        <select aria-label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass}>
          <option value="">All plans</option>
          {PLANS.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <input aria-label="Search bookings" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code or email" className={inputClass} />
      </div>
      {!bookings ? (
        <Spinner />
      ) : shown.length ? (
        <>
          <p className="mt-3 text-sm text-slate-500">
            {shown.length} {shown.length === 1 ? 'booking' : 'bookings'} · {naira(shown.reduce((t, b) => t + (b.status === 'paid' ? b.amount : 0), 0))} paid
          </p>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            {shown.map((b) => <BookingCard key={b.reference} booking={b} call={call} notify={notify} reload={() => void load()} />)}
          </div>
        </>
      ) : (
        <Empty>No bookings match.</Empty>
      )}
    </div>
  );
};

export default BookingsSection;
