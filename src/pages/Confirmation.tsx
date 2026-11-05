import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2, Mail, Printer } from 'lucide-react';
import BookingPass, { type PassStatus } from '@/components/BookingPass';
import { Button } from '@/components/ui/button';

type BookingDetails = {
  status: string;
  plan_title: string;
  full_name: string;
  email: string;
  amount: number;
  booking_date: string | null;
  valid_until: string | null;
};

// How long to keep checking while the payment is confirmed.
const MAX_CHECKS = 6;
const CHECK_INTERVAL_MS = 3000;

const passStatus = (booking: BookingDetails): PassStatus => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  if (booking.booking_date && today < booking.booking_date) return 'upcoming';
  if (booking.valid_until && today > booking.valid_until) return 'expired';
  return 'valid';
};

const passCode = (reference: string) => `FET-${reference.replace(/^fet_/, '').slice(0, 8).toUpperCase()}`;

export default function Confirmation() {
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reference = searchParams.get('reference') || searchParams.get('trxref');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const fetchBooking = async (check: number) => {
      if (!reference) {
        setError('No payment reference found. Payment may not have been completed.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/booking-status?reference=${encodeURIComponent(reference)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch booking details');
        }

        const data: BookingDetails = await response.json();
        if (cancelled) return;

        if (data.status === 'pending' && check < MAX_CHECKS) {
          timer = setTimeout(() => fetchBooking(check + 1), CHECK_INTERVAL_MS);
          return;
        }

        if (data.status === 'paid') {
          setBooking(data);
        } else {
          setError('We have not confirmed your payment yet. You will get your pass by email once it is confirmed.');
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching booking:', err);
        setError('We could not check this pass right now. Your payment may still be processing.');
        setLoading(false);
      }
    };

    fetchBooking(1);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reference]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-50 px-4 py-10 print:bg-white print:py-0">
      <div className="w-full max-w-md">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 font-medium text-[#0B1F3F]">Confirming your payment...</p>
            <p className="mt-1 text-sm text-slate-500">This can take up to a minute. Please keep this page open.</p>
          </div>
        ) : booking && reference ? (
          <>
            <div className="mb-6 text-center print:hidden">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#0B1F3F]">
                {passStatus(booking) === 'expired' ? 'This pass has expired' : "You're all set!"}
              </h1>
              <p className="mt-1 text-slate-600">
                {passStatus(booking) === 'expired'
                  ? 'Book a new pass to use the hub again.'
                  : "Here's your pass. Show it at the hub entrance."}
              </p>
            </div>

            <BookingPass
              status={passStatus(booking)}
              planTitle={booking.plan_title}
              holder={booking.full_name}
              amount={booking.amount}
              date={booking.booking_date}
              validUntil={booking.valid_until}
              code={passCode(reference)}
              qrValue={`${window.location.origin}/booking/confirmation?reference=${encodeURIComponent(reference)}`}
              notchClassName="bg-slate-50 print:bg-white"
            />

            <div className="mt-6 print:hidden">
              <p className="break-words text-center text-sm text-slate-600">
                <Mail className="mr-1.5 inline h-4 w-4 align-text-bottom text-primary" />
                Your pass is also sent to {booking.email}
              </p>
              <div className="mt-5 flex gap-3">
                <Button onClick={() => window.print()} variant="outline" className="h-11 flex-1 rounded-full">
                  <Printer className="mr-2 h-4 w-4" /> Save / Print
                </Button>
                <Button asChild className="h-11 flex-1 rounded-full font-bold">
                  <Link to="/">Back to home</Link>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-[#0B1F3F]">No valid pass to show yet</h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            {reference && <code className="mt-4 block break-all rounded-lg bg-slate-100 p-2 text-xs text-slate-600">{reference}</code>}
            <p className="mt-4 text-sm text-slate-500">
              Already paid and still no pass? Email{' '}
              <a className="font-medium text-primary" href="mailto:fetuilstechhub@gmail.com">fetuilstechhub@gmail.com</a>{' '}
              with this reference.
            </p>
            <Button asChild className="mt-6 h-11 rounded-full px-8 font-bold">
              <Link to="/pricing">Back to pricing</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
