export const EVENTS_API = `${import.meta.env.VITE_API_BASE_URL}/api/events`;

export type PublicEvent = {
  slug: string;
  title: string;
  description: string;
  starts_at: string;
  organiser: string;
  open: boolean;
};

export const eventLink = (slug: string) => `${window.location.origin}/events/${slug}`;

export const eventDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });

export const eventTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' });

// HH:MM in Lagos, for a time input.
export const lagosTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Lagos' });
