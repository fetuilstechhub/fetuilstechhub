import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, Loader2, MapPin } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EVENTS_API, eventDate, eventTime, type PublicEvent } from '@/lib/events';

const EventPage = () => {
  const { slug = '' } = useParams();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loadError, setLoadError] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<null | { emailSent: boolean; already: boolean }>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${EVENTS_API}/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 404) return setLoadError('We could not find this event. Check the link you were sent.');
        if (!response.ok) throw new Error('failed');
        setEvent(await response.json());
      })
      .catch(() => !cancelled && setLoadError('We could not load this event. Check your connection and try again.'));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const register = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${EVENTS_API}/${encodeURIComponent(slug)}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, website }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'We could not register you. Please try again.');
        if (response.status === 410 && event) setEvent({ ...event, open: false });
        return;
      }
      setDone({ emailSent: body.email_sent !== false, already: !!body.already_registered });
    } catch {
      setError('Could not reach our server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <section className="container mx-auto mt-[50px] px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl">
          {!event && !loadError && (
            <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>
          )}
          {loadError && (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">{loadError}</div>
          )}
          {event && (
            <>
              <div className="overflow-hidden rounded-3xl bg-[#0B1F3F] text-white">
                <div className="border-b-4 border-primary p-6 sm:p-8">
                  <div className="text-xs font-bold uppercase tracking-widest text-white/60">Event at FETUILS TechHub</div>
                  <h1 className="mt-2 break-words text-3xl font-extrabold tracking-tight md:text-4xl">{event.title}</h1>
                  <p className="mt-2 text-white/70">Hosted by {event.organiser}</p>
                </div>
                <div className="grid gap-4 p-6 text-sm sm:grid-cols-3 sm:p-8">
                  <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />{eventDate(event.starts_at)}</div>
                  <div className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />Starts {eventTime(event.starts_at)}</div>
                  <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />FETUILS TechHub, NLNG, UNILORIN</div>
                </div>
              </div>

              {event.description && (
                <p className="mt-6 whitespace-pre-line break-words rounded-3xl border border-slate-200 bg-white p-6 text-slate-700 sm:p-8">
                  {event.description}
                </p>
              )}

              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
                {done ? (
                  <div className="text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                    <h2 className="mt-3 text-2xl font-extrabold text-[#0B1F3F]">
                      {done.already ? "You're already registered" : "You're registered!"}
                    </h2>
                    <p className="mt-2 text-slate-600">
                      {done.already
                        ? 'Use the event pass we emailed you when you first registered.'
                        : done.emailSent
                          ? <>We've emailed your event pass to <strong className="break-words">{email}</strong>. Show it at the hub entrance.</>
                          : 'We could not send your email right now, but you are on the guest list. Give your name at the entrance.'}
                    </p>
                  </div>
                ) : event.open ? (
                  <form onSubmit={register} className="space-y-5">
                    <h2 className="text-xl font-bold text-[#0B1F3F]">Register to attend</h2>
                    <div>
                      <label htmlFor="guest-name" className="mb-2 block text-sm font-medium text-[#0B1F3F]">Full name</label>
                      <Input id="guest-name" className="h-12 rounded-xl" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
                    </div>
                    <div>
                      <label htmlFor="guest-email" className="mb-2 block text-sm font-medium text-[#0B1F3F]">Email</label>
                      <Input id="guest-email" className="h-12 rounded-xl" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
                    </div>
                    <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                    {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
                    <Button type="submit" size="lg" className="h-12 w-full rounded-full font-bold" disabled={busy}>
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Register'}
                    </Button>
                    <p className="text-center text-xs text-slate-500">You'll get your event pass by email.</p>
                  </form>
                ) : (
                  <p className="text-center font-semibold text-slate-600">Registration for this event has closed.</p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default EventPage;
