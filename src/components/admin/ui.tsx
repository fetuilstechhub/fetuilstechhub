import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type Notify = (text: string, good?: boolean) => void;

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>{children}</div>
);

export const SectionTitle = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-2xl font-extrabold text-[#0B1F3F]">{title}</h2>
    {action}
  </div>
);

export const Spinner = () => <Loader2 className="mx-auto my-10 h-8 w-8 animate-spin text-slate-400" />;

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-10 text-center text-slate-500">{children}</p>;

export const Button = ({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'green' | 'danger' }) => {
  const styles = {
    primary: 'bg-[#0B1F3F] text-white',
    outline: 'border border-slate-300 bg-white text-slate-700',
    green: 'bg-emerald-600 text-white',
    danger: 'border border-red-200 bg-white text-red-700',
  }[variant];
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold disabled:opacity-60 ${styles} ${className}`}
    />
  );
};

export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-medium text-[#0B1F3F]">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
  </label>
);

export const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[#0B1F3F]';

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-900',
  pending: 'bg-amber-100 text-amber-900',
  cancelled: 'bg-slate-100 text-slate-600',
  failed: 'bg-red-100 text-red-800',
};
const STATUS_LABEL: Record<string, string> = { paid: 'Paid', pending: 'Waiting for payment', cancelled: 'Cancelled', failed: 'Failed' };

export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? 'bg-slate-100'}`}>
    {STATUS_LABEL[status] ?? status}
  </span>
);
