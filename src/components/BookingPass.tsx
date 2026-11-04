import { QRCodeSVG } from 'qrcode.react';
import { QrCode } from 'lucide-react';

export type PassStatus = 'preview' | 'valid' | 'upcoming' | 'expired';

const STATUS: Record<PassStatus, { label: string; className: string }> = {
  preview: { label: 'Preview', className: 'bg-white/10 text-white/80' },
  valid: { label: 'Valid today', className: 'bg-emerald-400 text-emerald-950' },
  upcoming: { label: 'Paid · Upcoming', className: 'bg-amber-300 text-amber-950' },
  expired: { label: 'Expired', className: 'bg-red-500 text-white' },
};

export const formatPassDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

type Props = {
  status: PassStatus;
  planTitle: string;
  holder: string;
  amount: number;
  date: string | null;
  validUntil?: string | null;
  code?: string;
  qrValue?: string;
  /** Colour of the page behind the pass, so the ticket notches look cut out. */
  notchClassName?: string;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
    <div className="mt-1 truncate font-semibold text-[#0B1F3F]" title={value}>{value}</div>
  </div>
);

const BookingPass = ({
  status,
  planTitle,
  holder,
  amount,
  date,
  validUntil,
  code,
  qrValue,
  notchClassName = 'bg-background',
}: Props) => {
  const { label, className } = STATUS[status];
  const validText = date
    ? validUntil && validUntil !== date
      ? `${formatPassDate(date)} – ${formatPassDate(validUntil)}`
      : formatPassDate(date)
    : 'Select a date';

  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-20px_rgba(11,31,63,0.35)] ring-1 ring-slate-200/70 print:shadow-none">
      <div className="flex items-center justify-between px-5 py-3">
        <img src="/logo.png" alt="FETUILS TechHub" className="-ml-4 h-11 w-auto" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Hub Pass</span>
      </div>

      <div className="relative overflow-hidden bg-[#0B1F3F] px-6 py-6 text-white">
        <div aria-hidden className="absolute -right-10 -top-14 h-40 w-40 rotate-45 rounded-3xl bg-primary/90" />
        <div aria-hidden className="absolute -right-4 top-14 h-24 w-24 rotate-45 rounded-2xl bg-primary/30" />
        <div className="relative pr-16">
          <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold ${className}`}>{label}</span>
          <h3 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">{planTitle || 'Choose a plan'}</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-6 py-5 text-sm">
        <div className="col-span-2">
          <Field label="Pass holder" value={holder || 'Your name'} />
        </div>
        <div className="col-span-2">
          <Field label={validUntil && validUntil !== date ? 'Valid' : 'Date'} value={validText} />
        </div>
        <Field label={status === 'preview' ? 'Amount' : 'Amount paid'} value={`₦${amount.toLocaleString()}`} />
        <Field label="Location" value="FET, UNILORIN" />
      </div>

      <div className="relative h-6" aria-hidden>
        <div className={`absolute -left-3 top-0 h-6 w-6 rounded-full ${notchClassName} shadow-[inset_-2px_0_2px_-1px_rgba(11,31,63,0.12)]`} />
        <div className={`absolute -right-3 top-0 h-6 w-6 rounded-full ${notchClassName} shadow-[inset_2px_0_2px_-1px_rgba(11,31,63,0.12)]`} />
        <div className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-slate-200" />
      </div>

      <div className="flex flex-col items-center px-6 pb-6 pt-3 text-center">
        {qrValue ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <QRCodeSVG value={qrValue} size={148} fgColor="#0B1F3F" level="M" title="Pass QR code" />
          </div>
        ) : (
          <div className="flex h-[174px] w-[174px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
            <QrCode className="h-9 w-9" />
            <span className="px-5 text-xs leading-snug">Your QR code appears after payment</span>
          </div>
        )}
        {code && <div className="mt-3 font-mono text-base font-bold tracking-[0.2em] text-[#0B1F3F]">{code}</div>}
        <p className="mt-2 text-xs text-slate-500">
          {status === 'expired'
            ? 'This pass is no longer valid'
            : qrValue
              ? 'Show this pass at the hub entrance'
              : "We'll email your pass as soon as you've paid"}
        </p>
      </div>
    </div>
  );
};

export default BookingPass;
