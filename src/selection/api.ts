// Core team selection (temporary). Everything for it lives in src/selection.
const TOKEN_KEY = 'selection_token';
const NAME_KEY = 'selection_name';
export const SELECTION_API = `${import.meta.env.VITE_API_BASE_URL}/api/selection`;

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Private browsing: sign in again next time.
  }
};
export const getToken = () => read(TOKEN_KEY);
export const setToken = (token: string | null) => write(TOKEN_KEY, token);
export const getName = () => read(NAME_KEY) ?? '';
export const setName = (name: string) => write(NAME_KEY, name.trim() || null);

export class SignedOut extends Error {}

export type Call = <T = unknown>(path: string, options?: { method?: string; body?: unknown; csv?: string }) => Promise<T>;

export const makeCall = (token: string, onSignedOut: () => void): Call =>
  async (path, options = {}) => {
    const hasBody = options.body !== undefined || options.csv !== undefined;
    const response = await fetch(`${SELECTION_API}/${path}`, {
      method: options.method ?? (hasBody ? 'POST' : 'GET'),
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.csv !== undefined ? { 'Content-Type': 'text/csv' } : options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.csv !== undefined ? options.csv : options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (response.status === 401) {
      onSignedOut();
      throw new SignedOut('signed_out');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Something went wrong. Check the internet and try again.');
    return body;
  };

export type Login = { id: string; email: string; label: string; role: 'admin' | 'lead'; teams: string[] };

export type Status = 'new' | 'shortlisted' | 'interview' | 'accepted' | 'rejected' | 'withdrawn';

export type Application = {
  id: string;
  team: string;
  team_locked: boolean;
  applicant_name: string;
  applicant_email: string;
  applicant_email_alt: string;
  phone: string;
  phone_wa: string;
  role_raw: string;
  submitted_at: string | null;
  is_unilorin: boolean | null;
  faculty_dept: string;
  matric_number?: string;
  hours_per_week: string;
  hours_bucket: 'lt5' | '5to9' | '10plus' | 'unknown';
  available_on_site: string;
  on_site_bucket: 'yes' | 'maybe' | 'no' | 'unknown';
  skills: string;
  portfolio_links: string[];
  returning: boolean;
  answers: { q: string; a: string }[];
  problems: string[];
  status: Status;
  rubric: Partial<Record<RubricKey, number>>;
  score: number | null;
  track: '' | 'innovation' | 'training';
  contacted: boolean;
  last_contacted_at: string | null;
  updated_at: string | null;
  updated_by: string;
};

export type Activity = {
  id: string;
  kind: 'status' | 'score' | 'note' | 'message' | 'team' | 'track' | 'import';
  from_value: string | null;
  to_value: string | null;
  text: string | null;
  channel: 'whatsapp' | 'email' | 'copy' | null;
  template_id: string | null;
  by_login: string;
  by_name: string;
  undone: boolean;
  created_at: string;
};

export type Template = { id: string; label: string; subject: string; body: string };
export type Settings = {
  session_name: string;
  group_link: string;
  reply_to_email: string;
  leads_can_accept: boolean;
  templates: Template[];
};

export const TEAMS = [
  { id: 'operations', label: 'Operations' },
  { id: 'technical', label: 'Technical' },
  { id: 'sales', label: 'Sales' },
  { id: 'partnerships', label: 'Partnerships' },
  { id: 'community', label: 'Community' },
  { id: 'design', label: 'Design and Branding' },
  { id: 'studio-podcast', label: 'Studio and Podcast' },
  { id: 'media', label: 'Media and Publicity' },
  { id: 'unassigned', label: 'Needs assigning' },
];
export const teamLabel = (id: string) => TEAMS.find((t) => t.id === id)?.label ?? id;

export const STATUSES: { id: Status; label: string; style: string }[] = [
  { id: 'new', label: 'New', style: 'bg-slate-100 text-slate-700' },
  { id: 'shortlisted', label: 'Shortlisted', style: 'bg-sky-100 text-sky-900' },
  { id: 'interview', label: 'Interview', style: 'bg-violet-100 text-violet-900' },
  { id: 'accepted', label: 'Accepted', style: 'bg-emerald-100 text-emerald-900' },
  { id: 'rejected', label: 'Rejected', style: 'bg-red-100 text-red-800' },
  { id: 'withdrawn', label: 'Withdrawn', style: 'bg-amber-100 text-amber-900' },
];
export const statusLabel = (id: string) => STATUSES.find((s) => s.id === id)?.label ?? id;
// Only applicants selected for the next phase can be contacted.
export const CONTACTABLE: Status[] = ['shortlisted', 'interview', 'accepted'];

export type RubricKey = 'commitment' | 'skill' | 'reliability' | 'teamwork' | 'evidence';
export const RUBRIC: { key: RubricKey; label: string }[] = [
  { key: 'commitment', label: 'Commitment and availability' },
  { key: 'skill', label: 'Skill or willingness to learn' },
  { key: 'reliability', label: 'Reliability and attitude' },
  { key: 'teamwork', label: 'Works well in a team' },
  { key: 'evidence', label: 'Past work, portfolio or task' },
];

export const HOURS: Record<string, string> = { lt5: 'Under 5 hrs', '5to9': '5 to 9 hrs', '10plus': '10+ hrs', unknown: 'Hours unclear' };
export const ON_SITE: Record<string, string> = { yes: 'On site: yes', maybe: 'On site: maybe', no: 'On site: no', unknown: 'On site: unclear' };

export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? '';

export const PLACEHOLDERS = [
  'firstName', 'fullName', 'team', 'leadName', 'leadTeam', 'interviewDate', 'interviewTime', 'interviewLink', 'groupLink', 'session',
] as const;
// Filled by the lead before sending; the rest come from the applicant and settings.
export const ASKED: Record<string, string> = { interviewDate: 'Interview date', interviewTime: 'Interview time', interviewLink: 'Link or venue' };

export const usedPlaceholders = (body: string) => [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];

export const renderTemplate = (body: string, values: Record<string, string>) =>
  body.replace(/\{\{(\w+)\}\}/g, (all, key: string) => values[key] || all);

export const whatsappLink = (phoneWa: string, message: string) => `https://wa.me/${phoneWa}?text=${encodeURIComponent(message)}`;

// Opens WhatsApp in a new tab without giving it a handle back to this page.
export const openOutside = (url: string) => {
  const tab = window.open(url, '_blank');
  if (tab) tab.opener = null;
  else window.location.href = url;
};

export const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' }) : '';
export const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }) : '';

export const randomPassword = () => {
  const words = ['amber', 'river', 'solar', 'maple', 'cedar', 'lunar', 'coral', 'ember', 'delta', 'orbit', 'pixel', 'falcon', 'harbor', 'meadow', 'quartz', 'tiger', 'violet', 'willow', 'zephyr', 'canyon'];
  const n = new Uint32Array(5);
  crypto.getRandomValues(n);
  return `${words[n[0] % words.length]}-${words[n[1] % words.length]}-${words[n[2] % words.length]}-${words[n[3] % words.length]}-${(n[4] % 90) + 10}`;
};
