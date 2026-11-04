import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, Loader2, Lock } from 'lucide-react';
import { workspacePlans, rentalItems } from '@/lib/plans';
import BookingPass from '@/components/BookingPass';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

type PlanOption = { id: string; title: string; price: number; period?: string };

const allPlans: PlanOption[] = [...workspacePlans, ...rentalItems];

const StepHeading = ({ step, title }: { step: number; title: string }) => (
  <div className="mb-5 flex items-center gap-3">
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#0B1F3F] text-sm font-bold text-white">
      {step}
    </span>
    <h2 className="text-lg font-bold text-[#0B1F3F]">{title}</h2>
  </div>
);

const PlanCard = ({ plan, selected, onSelect }: { plan: PlanOption; selected: boolean; onSelect: () => void }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
      selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
    }`}
  >
    {selected && (
      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    )}
    <div className="pr-6 text-sm font-semibold text-[#0B1F3F]">{plan.title}</div>
    <div className="mt-2 text-lg font-extrabold text-[#0B1F3F]">₦{plan.price.toLocaleString()}</div>
    <div className="text-xs text-slate-500">{plan.period}</div>
  </button>
);

const Booking = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [notes, setNotes] = useState('');
  const [planId, setPlanId] = useState(workspacePlans[0].id);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  const plan = allPlans.find((p) => p.id === planId) ?? allPlans[0];

  const showError = (description: string) =>
    toast({ title: 'Booking not completed', description, variant: 'destructive' });

  // The API can sleep when idle, so wake it before the customer submits.
  useEffect(() => {
    fetch(`${apiBase}/api/health`).catch(() => {});
  }, [apiBase]);

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('plan');
    if (requested && allPlans.some((p) => p.id === requested)) setPlanId(requested);
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const resp = await fetch(`${apiBase}/api/create-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, booking_date: bookingDate, plan_id: planId, notes }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        showError(json?.error || 'We could not start your payment. Please try again.');
        return;
      }

      if (json.authorization_url) {
        window.location.href = json.authorization_url;
      } else {
        showError('We could not start your payment. Please try again.');
      }
    } catch (err) {
      console.error(err);
      showError('Could not reach our server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <section className="container mx-auto mt-[50px] px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0B1F3F] md:text-4xl">Get your hub pass</h1>
            <p className="mt-3 text-slate-600">
              Choose a plan and pay online. We'll email your pass, and you show it at the entrance when you arrive.
            </p>
          </div>

          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
                <StepHeading step={1} title="Choose your plan" />
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Workspace</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {workspacePlans.map((p) => (
                    <PlanCard key={p.id} plan={p} selected={planId === p.id} onSelect={() => setPlanId(p.id)} />
                  ))}
                </div>
                <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Studio</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {rentalItems.map((p) => (
                    <PlanCard key={p.id} plan={p} selected={planId === p.id} onSelect={() => setPlanId(p.id)} />
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
                <StepHeading step={2} title="Your details" />
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="booking-name" className="mb-2 block text-sm font-medium text-[#0B1F3F]">Full name</label>
                    <Input id="booking-name" className="h-12 rounded-xl" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="As it should appear on your pass" autoComplete="name" required />
                  </div>
                  <div>
                    <label htmlFor="booking-email" className="mb-2 block text-sm font-medium text-[#0B1F3F]">Email</label>
                    <Input id="booking-email" className="h-12 rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required />
                  </div>
                  <div>
                    <label htmlFor="booking-date" className="mb-2 block text-sm font-medium text-[#0B1F3F]">Start date</label>
                    <Input
                      id="booking-date"
                      className="h-12 rounded-xl"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      type="date"
                      min={new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="booking-notes" className="mb-2 block text-sm font-medium text-[#0B1F3F]">
                      Notes <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      id="booking-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      className="w-full rounded-xl border border-input bg-background p-3 text-sm"
                      placeholder="Arrival time, accessibility needs, anything we should know"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-3xl bg-[#0B1F3F] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div>
                  <div className="text-sm text-white/60">Total</div>
                  <div className="text-3xl font-extrabold">₦{plan.price.toLocaleString()}</div>
                </div>
                <div className="sm:text-right">
                  <Button type="submit" size="lg" className="h-12 w-full rounded-full px-8 font-bold sm:w-auto" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting to Paystack...
                      </>
                    ) : (
                      `Pay ₦${plan.price.toLocaleString()}`
                    )}
                  </Button>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-white/60 sm:justify-end">
                    <Lock className="h-3 w-3" /> Secure payment by Paystack
                  </div>
                </div>
              </div>
            </form>

            <aside className="lg:sticky lg:top-24">
              <BookingPass
                status="preview"
                planTitle={plan.title}
                holder={fullName}
                amount={plan.price}
                date={bookingDate || null}
                notchClassName="bg-slate-50"
              />
              <p className="mt-5 text-center text-sm text-slate-500">
                Need help?{' '}
                <a className="font-medium text-primary" href="mailto:fetuilstechhub@gmail.com">
                  fetuilstechhub@gmail.com
                </a>
              </p>
            </aside>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Booking;
