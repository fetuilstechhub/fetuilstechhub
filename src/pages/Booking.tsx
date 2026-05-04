import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { workspacePlans, rentalItems } from '@/lib/plans';
import OrderSummary from '@/components/OrderSummary';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Booking = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [planId, setPlanId] = useState(workspacePlans[0].id);
  const [amount, setAmount] = useState(workspacePlans[0].price);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const apiBase = import.meta.env.VITE_API_BASE_URL || '';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const plan = params.get('plan');
    if (plan) {
      const found = workspacePlans.find((p) => p.id === plan) || rentalItems.find((r) => r.id === plan);
      if (found) {
        setPlanId(plan);
        setAmount(found.price);
      }
    }
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body = {
        full_name: fullName,
        email,
        booking_date: bookingDate,
        start_time: bookingDate ? `${bookingDate}T09:00:00.000Z` : null,
        plan_id: planId,
        plan_title: (workspacePlans.find((p) => p.id === planId) || rentalItems.find((r) => r.id === planId))?.title || planId,
        amount,
        metadata: { source: 'web', booking_date: bookingDate },
      };

      const resp = await fetch(`${apiBase}/api/create-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const message = json?.details?.message || json?.error || 'Failed to create transaction.';
        alert(message);
        return;
      }

      if (json.authorization_url) {
        window.location.href = json.authorization_url;
      } else {
        alert('No payment URL returned from server.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <section className="container mt-[50px] mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-8 shadow-sm">
            <h1 className="text-3xl font-bold mb-2">Book a Workspace or Service</h1>
            <p className="text-muted-foreground mb-6">Choose a plan and complete your payment , we'll email your booking confirmation.</p>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Full name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" required />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Booking date</label>
                <Input
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Select plan / service</label>
                <div className="grid md:grid-cols-3 gap-3">
                  {[...workspacePlans, ...rentalItems].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setPlanId(p.id); setAmount(p.price); }}
                      className={`text-left p-3 rounded-lg border ${planId === p.id ? 'border-primary bg-primary/5' : 'border-border bg-card'} hover:shadow-sm`}
                    >
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-sm text-muted-foreground">₦{p.price} {p.period ?? ''}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 mt-4">
                <label className="block text-sm font-medium mb-2">Additional notes (optional)</label>
                <textarea className="w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="Any details we should know (e.g., arrival time, accessibility needs)" rows={4} />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div className="text-2xl font-bold">₦{amount}</div>
                  </div>

                  <div className="w-48">
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Redirecting...' : `Pay ₦${amount}`}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <aside className="sticky top-24 rounded-2xl p-6 bg-card border border-border">
            <OrderSummary
              fullName={fullName}
              email={email}
              planTitle={(workspacePlans.find((p) => p.id === planId) || rentalItems.find((r) => r.id === planId))?.title || ''}
              amount={amount}
              bookingDate={bookingDate}
            />

            <div className="mt-6 text-sm text-muted-foreground">
              <p className="mb-2">Need help? Email <a className="text-primary" href="mailto:support@fetuils.ng">support@fetuils.ng</a></p>
              <p>Operating Hours: 9 AM – 6 PM (Mon - Fri)</p>
            </div>
          </aside>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Booking;
