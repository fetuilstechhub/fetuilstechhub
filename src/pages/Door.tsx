import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import jsQR from 'jsqr';
import { Camera, Check, ListChecks, Loader2, LogOut, UserCheck, X } from 'lucide-react';
import { getToken, setToken } from '@/lib/staff-auth';

const API = `${import.meta.env.VITE_API_BASE_URL}/api/door`;
// Customers often keep their phone up after going green. Without this pause,
// "Scan next" would read the same code again and show a confusing red.
const RESCAN_PAUSE_MS = 5000;
const TRUSTED_HOSTS = ['fetuils.ng', 'www.fetuils.ng', 'fetuilstechhub.vercel.app', window.location.host];

type Pass = {
  holder?: string;
  plan_title?: string;
  code?: string;
  reference?: string;
  valid_until?: string | null;
  starts_on?: string | null;
  entries_today?: number;
  entries_allowed?: number;
  last_entry_at?: string | null;
  photo?: string | null;
};
type DoorResponse = Pass & { verdict: 'enter' | 'deny' | 'confirm_photo' | 'take_photo'; reason?: string };
type Entry = { at: string; holder: string; plan_title: string };
type Screen =
  | { name: 'scan' }
  | { name: 'working' }
  | { name: 'entries'; entries: Entry[] }
  | { name: 'manual' }
  | { name: 'error'; message: string }
  | { name: 'result'; result: DoorResponse };

const time = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' }) : '';
const day = (date?: string | null) =>
  date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const denyText = (result: DoorResponse): { title: string; detail: string } => {
  switch (result.reason) {
    case 'used':
      return {
        title: 'ALREADY USED',
        detail: result.entries_allowed && result.entries_allowed > 1
          ? `All ${result.entries_allowed} entries used today`
          : `Came in today at ${time(result.last_entry_at)}`,
      };
    case 'expired':
      return { title: 'EXPIRED', detail: `Ended on ${day(result.valid_until)}` };
    case 'not_started':
      return { title: 'NOT YET', detail: `Starts on ${day(result.starts_on)}` };
    case 'not_paid':
      return { title: 'NOT PAID', detail: 'Payment was not completed' };
    case 'wrong_person':
      return { title: 'WRONG PERSON', detail: 'This is not the pass holder' };
    default:
      return { title: 'FAKE PASS', detail: 'This is not a real FETUILS pass' };
  }
};

// Reads a scanned QR code. Anything not pointing at our own site is treated as fake.
const referenceFromQr = (text: string): string | null => {
  try {
    const url = new URL(text);
    if (!TRUSTED_HOSTS.includes(url.host) || url.pathname !== '/booking/confirmation') return null;
    return url.searchParams.get('reference');
  } catch {
    return null;
  }
};

let audio: AudioContext | null = null;
const tone = (frequency: number, start: number, length: number, type: OscillatorType) => {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = 0.4;
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + length);
};
const playGood = () => {
  tone(880, 0, 0.14, 'sine');
  tone(1320, 0.16, 0.22, 'sine');
  navigator.vibrate?.(120);
};
const playBad = () => {
  tone(170, 0, 0.8, 'sawtooth');
  navigator.vibrate?.([300, 100, 300]);
};
const unlockAudio = () => {
  audio ??= new AudioContext();
  void audio.resume();
};

const useCamera = (active: boolean, onError: (message: string) => void) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | undefined;
    let stopped = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => onError('Camera is blocked. Allow camera access for this site, then try again.'));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, onError]);

  return videoRef;
};

const BigButton = ({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...props}
    className={`flex h-20 w-full items-center justify-center gap-3 rounded-2xl text-2xl font-extrabold active:scale-[0.98] disabled:opacity-60 ${className}`}
  />
);

const Login = ({ onSignedIn }: { onSignedIn: (token: string) => void }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    unlockAudio();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.token) onSignedIn(body.token);
      else setError(body.error || 'Could not sign in. Try again.');
    } catch {
      setError('No internet connection. Try again.');
    } finally {
      setBusy(false);
      setPin('');
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center gap-5 px-6 text-white">
      <h1 className="text-center text-3xl font-extrabold">Door Scanner</h1>
      <input
        aria-label="Staff PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        placeholder="Staff PIN"
        className="h-20 rounded-2xl bg-white px-4 text-center text-3xl font-bold tracking-widest text-[#0B1F3F] placeholder:text-lg placeholder:font-normal placeholder:tracking-normal"
      />
      {error && <p role="alert" className="text-center text-lg font-semibold text-red-300">{error}</p>}
      <BigButton type="submit" disabled={busy || !pin} className="bg-primary text-white">
        {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : 'Open scanner'}
      </BigButton>
    </form>
  );
};

const Scanner = ({ onCode, onError, ignore }: { onCode: (text: string) => void; onError: (message: string) => void; ignore: { text: string; until: number } }) => {
  const videoRef = useCamera(true, onError);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let frame = 0;
    let last = 0;
    let done = false;

    const tick = (now: number) => {
      if (done) return;
      frame = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (now - last < 150 || !context || !video || video.readyState < video.HAVE_ENOUGH_DATA) return;
      last = now;
      canvas.width = Math.min(video.videoWidth, 800);
      canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
      if (code?.data && !(code.data === ignore.text && Date.now() < ignore.until)) {
        done = true;
        onCode(code.data);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      done = true;
      cancelAnimationFrame(frame);
    };
  }, [ignore, onCode, videoRef]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
      <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="h-64 w-64 rounded-3xl border-4 border-white/90 shadow-[0_0_0_2000px_rgba(0,0,0,0.45)]" />
        <p className="relative mt-5 text-2xl font-extrabold text-white">Point at the QR code</p>
      </div>
    </div>
  );
};

const TakePhoto = ({ result, onDone, onError }: { result: DoorResponse; onDone: (photo: string) => void; onError: (message: string) => void }) => {
  const videoRef = useCamera(true, onError);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = Math.round((360 / video.videoWidth) * video.videoHeight);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    onDone(canvas.toDataURL('image/jpeg', 0.7));
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0B1F3F] text-white">
      <div className="px-5 py-4 text-center">
        <h1 className="text-3xl font-extrabold">TAKE THEIR PHOTO</h1>
        <p className="mt-1 truncate text-lg text-white/80">{result.holder}</p>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="p-4">
        <BigButton onClick={capture} className="bg-white text-[#0B1F3F]">
          <Camera className="h-8 w-8" /> Take photo
        </BigButton>
      </div>
    </div>
  );
};

const ConfirmPhoto = ({ result, onSame, onDifferent }: { result: DoorResponse; onSame: () => void; onDifferent: () => void }) => (
  <div className="flex min-h-[100dvh] flex-col bg-[#0B1F3F] p-4 text-white">
    <h1 className="py-2 text-center text-3xl font-extrabold">SAME PERSON?</h1>
    {result.photo && <img src={result.photo} alt="Pass holder" className="min-h-0 flex-1 rounded-2xl bg-black object-contain" />}
    <p className="truncate py-3 text-center text-lg text-white/80">{result.holder}</p>
    <div className="grid grid-cols-2 gap-3">
      <BigButton onClick={onDifferent} className="bg-red-600 text-white"><X className="h-9 w-9" strokeWidth={3} /> No</BigButton>
      <BigButton onClick={onSame} className="bg-emerald-500 text-white"><Check className="h-9 w-9" strokeWidth={3} /> Yes</BigButton>
    </div>
  </div>
);

const Verdict = ({ result, onNext }: { result: DoorResponse; onNext: () => void }) => {
  const good = result.verdict === 'enter';
  const { title, detail } = good
    ? {
        title: 'LET IN',
        detail: result.entries_allowed && result.entries_allowed > 1
          ? `Entry ${result.entries_today} of ${result.entries_allowed} today`
          : result.plan_title ?? '',
      }
    : denyText(result);

  useEffect(() => {
    if (good) playGood();
    else playBad();
  }, [good]);

  return (
    <div className={`flex min-h-[100dvh] flex-col p-5 text-white ${good ? 'bg-emerald-600' : 'bg-red-600'}`} data-verdict={good ? 'enter' : 'deny'}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-white">
          {good ? <Check className="h-28 w-28 text-emerald-600" strokeWidth={3.5} /> : <X className="h-28 w-28 text-red-600" strokeWidth={3.5} />}
        </div>
        <h1 className="mt-7 text-5xl font-black tracking-tight">{title}</h1>
        <p className="mt-3 text-xl font-semibold">{detail}</p>
        {result.holder && <p className="mt-5 max-w-full truncate text-2xl font-bold">{result.holder}</p>}
        {!good && <p className="mt-6 rounded-xl bg-black/25 px-4 py-2 text-lg font-bold">Do not let in. Call the manager.</p>}
      </div>
      <BigButton onClick={onNext} className="bg-white text-[#0B1F3F]">Scan next</BigButton>
    </div>
  );
};

const Door = () => {
  const [token, setTokenState] = useState(getToken);
  const [screen, setScreen] = useState<Screen>({ name: 'scan' });
  const [manualCode, setManualCode] = useState('');
  const lastScan = useRef('');
  const [ignore, setIgnore] = useState({ text: '', until: 0 });

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setScreen({ name: 'scan' });
  }, []);

  const call = useCallback(
    async (path: string, body?: unknown) => {
      const response = await fetch(`${API}/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (response.status === 401) {
        signOut();
        throw new Error('signed_out');
      }
      if (!response.ok) throw new Error('failed');
      return response.json();
    },
    [signOut, token],
  );

  const submit = useCallback(
    async (path: string, body: unknown) => {
      setScreen({ name: 'working' });
      try {
        setScreen({ name: 'result', result: await call(path, body) });
      } catch (err) {
        if ((err as Error).message !== 'signed_out') {
          setScreen({ name: 'error', message: 'Could not check this pass. Check the internet and scan again.' });
        }
      }
    },
    [call],
  );

  const onCode = useCallback(
    (text: string) => {
      lastScan.current = text;
      const reference = referenceFromQr(text);
      if (reference) void submit('scan', { reference });
      else setScreen({ name: 'result', result: { verdict: 'deny', reason: 'not_found' } });
    },
    [submit],
  );

  const onCameraError = useCallback((message: string) => setScreen({ name: 'error', message }), []);

  const showEntries = async () => {
    setScreen({ name: 'working' });
    try {
      const { entries } = await call('entries');
      setScreen({ name: 'entries', entries });
    } catch (err) {
      if ((err as Error).message !== 'signed_out') {
        setScreen({ name: 'error', message: "Could not load today's entries. Check the internet." });
      }
    }
  };

  const next = () => {
    unlockAudio();
    setManualCode('');
    setIgnore({ text: lastScan.current, until: Date.now() + RESCAN_PAUSE_MS });
    setScreen({ name: 'scan' });
  };

  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-[#0B1F3F]">
        <Login onSignedIn={(t) => { setToken(t); setTokenState(t); }} />
      </div>
    );
  }

  if (screen.name === 'result') {
    const { result } = screen;
    if (result.verdict === 'take_photo') {
      return <TakePhoto result={result} onError={onCameraError} onDone={(photo) => void submit('check-in', { reference: result.reference, photo })} />;
    }
    if (result.verdict === 'confirm_photo') {
      return (
        <ConfirmPhoto
          result={result}
          onSame={() => void submit('check-in', { reference: result.reference })}
          onDifferent={() => setScreen({ name: 'result', result: { verdict: 'deny', reason: 'wrong_person', holder: result.holder } })}
        />
      );
    }
    return <Verdict result={result} onNext={next} />;
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0B1F3F] text-white" onClick={unlockAudio}>
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <h1 className="text-lg font-extrabold">Door Scanner</h1>
        <div className="flex gap-2">
          <button type="button" onClick={showEntries} className="flex h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold">
            <ListChecks className="h-5 w-5" /> Today
          </button>
          <button type="button" onClick={signOut} aria-label="Sign out" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {screen.name === 'scan' && (
        <>
          <Scanner onCode={onCode} onError={onCameraError} ignore={ignore} />
          <div className="p-4">
            <button type="button" onClick={() => setScreen({ name: 'manual' })} className="h-14 w-full rounded-xl bg-white/10 text-lg font-semibold">
              Can't scan? Type the code
            </button>
          </div>
        </>
      )}

      {screen.name === 'working' && (
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>
      )}

      {screen.name === 'manual' && (
        <form
          className="flex flex-1 flex-col justify-center gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit('scan', { code: manualCode });
          }}
        >
          <label htmlFor="pass-code" className="text-center text-2xl font-extrabold">Type the code on the pass</label>
          <input
            id="pass-code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="FET-A1B2C3D4"
            className="h-20 rounded-2xl bg-white px-3 text-center font-mono text-2xl font-bold text-[#0B1F3F]"
          />
          <BigButton type="submit" disabled={!manualCode} className="bg-primary text-white">Check pass</BigButton>
          <button type="button" onClick={next} className="h-14 text-lg font-semibold text-white/80">Back to camera</button>
        </form>
      )}

      {screen.name === 'error' && (
        <div className="flex flex-1 flex-col justify-center gap-6 p-5 text-center">
          <p role="alert" className="text-2xl font-bold">{screen.message}</p>
          <BigButton onClick={next} className="bg-white text-[#0B1F3F]">Try again</BigButton>
        </div>
      )}

      {screen.name === 'entries' && (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex items-center gap-2 text-xl font-extrabold">
            <UserCheck className="h-6 w-6" /> {screen.entries.length} {screen.entries.length === 1 ? 'entry' : 'entries'} today
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {screen.entries.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 p-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{entry.holder}</div>
                  <div className="truncate text-sm text-white/70">{entry.plan_title}</div>
                </div>
                <div className="flex-shrink-0 font-mono text-sm">{time(entry.at)}</div>
              </li>
            ))}
          </ul>
          <BigButton onClick={next} className="mt-3 bg-white text-[#0B1F3F]">Back to scanner</BigButton>
        </div>
      )}
    </div>
  );
};

export default Door;
