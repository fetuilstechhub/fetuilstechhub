import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { dateTime, naira, shortDate, SignedOut, type AdminCall, type Booking } from '@/lib/admin';
import { Button, Card, Empty, SectionTitle, Spinner, inputClass, type Notify } from './ui';

const Waiting = ({ payment, onConfirm }: { payment: Booking; onConfirm: (p: Booking) => Promise<void> }) => {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-lg font-bold text-[#0B1F3F]">{payment.holder}</div>
          <div className="font-mono text-sm text-slate-600">{payment.code}</div>
        </div>
        <div className="flex-shrink-0 text-xl font-extrabold text-[#0B1F3F]">{naira(payment.amount)}</div>
      </div>
      <div className="mt-2 space-y-0.5 text-sm text-slate-600">
        <div>{payment.plan_title}{payment.starts_on ? `, starts ${shortDate(payment.starts_on)}` : ''}</div>
        <div className="break-all">{payment.email}</div>
        <div className="text-slate-400">Booked {dateTime(payment.booked_at)}</div>
        {payment.notes && <div className="mt-1 break-words rounded-lg bg-slate-50 p-2">{payment.notes}</div>}
      </div>
      {asking ? (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p className="font-semibold text-amber-950">Is {naira(payment.amount)} from {payment.holder} in the bank account?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setAsking(false)}>Not yet</Button>
            <Button
              variant="green"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onConfirm(payment);
                setBusy(false);
                setAsking(false);
              }}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Yes, send pass'}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="mt-3 w-full" onClick={() => setAsking(true)}>
          <Check className="h-5 w-5" /> Payment received
        </Button>
      )}
    </Card>
  );
};

const PaymentsSection = ({ call, notify }: { call: AdminCall; notify: Notify }) => {
  const [waiting, setWaiting] = useState<Booking[] | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setWaiting((await call<{ waiting: Booking[] }>('payments')).waiting);
    } catch (err) {
      if (!(err instanceof SignedOut)) notify((err as Error).message, false);
    }
  }, [call, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async (payment: Booking) => {
    try {
      const body = await call<{ already_paid: boolean; email_sent: boolean }>('confirm-payment', { body: { reference: payment.reference } });
      if (body.already_paid) notify(`${payment.holder} was already confirmed.`);
      else if (body.email_sent) notify(`Payment confirmed. Pass emailed to ${payment.email}.`);
      else notify(`Payment confirmed, but the email failed. In Bookings, copy ${payment.holder}'s pass link and send it on WhatsApp.`, false);
      await load();
    } catch (err) {
      if (!(err instanceof SignedOut)) notify('Could not confirm this payment. Nothing was sent. Check the internet and try again.', false);
    }
  };

  const query = search.trim().toLowerCase();
  const shown = (waiting ?? []).filter((p) => !query || [p.holder, p.code, p.email].some((v) => v.toLowerCase().includes(query)));

  return (
    <div>
      <SectionTitle title={`Waiting for payment${waiting ? ` (${waiting.length})` : ''}`} action={<Button variant="outline" onClick={() => void load()}>Refresh</Button>} />
      <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
        Only confirm after you see the money in the bank account. Alerts and screenshots can be fake. Check the amount and booking code match.
      </p>
      <input aria-label="Search waiting payments" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code or email" className={inputClass} />
      {!waiting ? (
        <Spinner />
      ) : shown.length ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">{shown.map((p) => <Waiting key={p.reference} payment={p} onConfirm={confirm} />)}</div>
      ) : (
        <Empty>{query ? 'No bookings match your search.' : 'No bookings are waiting for payment.'}</Empty>
      )}
    </div>
  );
};

export default PaymentsSection;
