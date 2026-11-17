import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Copy, Loader2, MessageCircle } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPassDate } from '@/components/BookingPass';
import { EVENTS_API, eventLink, lagosTime, type PublicEvent } from '@/lib/events';

type Setup = { organiser: string; date: string | null; event: PublicEvent | null };

const EventSetup = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || '';
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loadError, setLoadError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<PublicEvent | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${EVENTS_API}/setup?reference=${encodeURIComponent(reference)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) return setLoadError(body.error || 'We could not load your booking.');
        setSetup(body);
        if (body.event) {
          setTitle(body.event.title);
          setDescription(body.event.description);
          setStartTime(lagosTime(body.event.starts_at));
          setSaved(body.event);
        }
      })
      .catch(() => !cancelled && setLoadError('Could not reach our server. Check your connection and try again.'));
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${EVENTS_API}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, title, description, start_time: startTime }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setError(body.error || 'We could not save your event. Please try again.');
      setSaved(body);
      setCopied(false);
      window.scrollTo({ top: 0 });
    } catch {
      setError('Could not reach our server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const link = saved ? eventLink(saved.slug) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt('Copy this link', link);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <section className="container mx-auto mt-[50px] px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0B1F3F] md:text-4xl">Set up your event page</h1>
          <p className="mt-3 text-slate-600">
            Share your event's link, and your guests register with their name and email. Each guest gets an event pass by email.
          </p>

          {!setup && !loadError && <div className="py-16 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>}
          {loadError && (
            <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">
              {loadError}
              <p className="mt-3 text-sm">Need help? Email <a className="font-medium text-primary" href="mailto:fetuilstechhub@gmail.com">fetuilstechhub@gmail.com</a></p>
            </div>
          )}

          {setup && (
            <>
              {saved && (
                <div className="mt-8 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-6">
                  <h2 className="text-lg font-bold text-emerald-950">Your event page is ready. Share this link</h2>
                  <div className="mt-3 break-all rounded-xl bg-white p-3 font-mono text-sm text-[#0B1F3F]">{link}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Button type="button" variant="outline" onClick={copy} className="h-11 rounded-full">
                      <Copy className="mr-2 h-4 w-4" /> {copied ? 'Copied' : 'Copy link'}
                    </Button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Register for ${saved.title}: ${link}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#128C3E] font-semibold text-white"
                    >
                      <MessageCircle className="h-4 w-4" /> Share on WhatsApp
                    </a>
                    <Button asChild variant="outline" className="h-11 rounded-full">
                      <Link to={`/events/${saved.slug}`}>View page</Link>
                    </Button>
                  </div>
                  <p className="mt-3 text-sm text-emerald-900">You can change the details below at any time. The link stays the same.</p>
                </div>
              )}

              <form onSubmit={save} className="mt-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
                <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div><div className="text-slate-500">Organiser</div><div className="font-semibold text-[#0B1F3F]">{setup.organiser}</div></div>
                  <div><div className="text-slate-500">Date</div><div className="font-semibold text-[#0B1F3F]">{setup.date ? formatPassDate(setup.date) : 'Not set'}</div></div>
                </div>
                <div>
                  <label htmlFor="event-title" className="mb-2 block text-sm font-medium text-[#0B1F3F]">Event name</label>
                  <Input id="event-title" className="h-12 rounded-xl" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Tech Summit 2026" required />
                </div>
                <div>
                  <label htmlFor="event-time" className="mb-2 block text-sm font-medium text-[#0B1F3F]">Start time</label>
                  <Input id="event-time" className="h-12 rounded-xl" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                  <p className="mt-1 text-xs text-slate-500">Registration closes 2 hours after the start time.</p>
                </div>
                <div>
                  <label htmlFor="event-description" className="mb-2 block text-sm font-medium text-[#0B1F3F]">
                    About the event <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="event-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                    rows={5}
                    className="w-full rounded-xl border border-input bg-background p-3 text-sm"
                    placeholder="What it's about, who should come, what to bring"
                  />
                </div>
                {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
                <Button type="submit" size="lg" className="h-12 w-full rounded-full font-bold" disabled={busy}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : saved ? 'Save changes' : 'Create event page'}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default EventSetup;
