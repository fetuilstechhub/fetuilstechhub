// Teams, statuses and default message templates for core team selection.

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
export const TEAM_IDS = TEAMS.map((t) => t.id);
// Team logins can be given any real team. "Needs assigning" is for the admin only.
export const LEAD_TEAM_IDS = TEAM_IDS.filter((id) => id !== 'unassigned');
export const teamLabel = (id) => TEAMS.find((t) => t.id === id)?.label ?? id;

export const STATUSES = ['new', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn'];
// Only applicants selected for the next phase can be contacted.
export const CONTACTABLE = ['shortlisted', 'interview', 'accepted'];
export const RUBRIC_KEYS = ['commitment', 'skill', 'reliability', 'teamwork', 'evidence'];
export const TRACKS = ['', 'innovation', 'training'];

export const DEFAULT_SETTINGS = {
  session_name: '2026/2027',
  group_link: '',
  reply_to_email: '',
  // When false, only the Lead and Co-lead can move someone to Accepted.
  leads_can_accept: false,
  templates: [
    {
      id: 'shortlisted',
      label: 'Shortlisted',
      subject: 'FETUILS TechHub: you have been shortlisted for {{team}}',
      body: `Hello {{firstName}}, this is {{leadName}}, {{team}} Lead at FETUILS TechHub.

Congratulations! You have been shortlisted for the next stage of the core team selection for the {{team}} team.

We will share the next steps shortly. Please reply to confirm you are still interested and available.

Thank you.`,
    },
    {
      id: 'interview',
      label: 'Interview or task',
      subject: 'FETUILS TechHub: next stage for {{team}}',
      body: `Hello {{firstName}}, this is {{leadName}} from FETUILS TechHub ({{team}}).

We would like to invite you for the next stage of selection.

Date: {{interviewDate}}
Time: {{interviewTime}}
Link or venue: {{interviewLink}}

Please reply to confirm you can make it. If not, tell us as early as you can.`,
    },
    {
      id: 'accepted',
      label: 'Accepted',
      subject: 'Welcome to the FETUILS TechHub {{team}} team',
      body: `Hello {{firstName}}, congratulations! 🎉

You have been selected as a core team member of the {{team}} team at FETUILS TechHub for the {{session}} session.

Please join the group here: {{groupLink}}

Welcome aboard!`,
    },
  ],
};

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// A plain, branded email around the lead's message. Links in the text become clickable.
export function messageEmailHtml({ body, frontendUrl }) {
  const paragraphs = escapeHtml(body)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" style="color:#E8481C;">${url}</a>`)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px 12px;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#0B1F3F;">
  <img src="${escapeHtml(frontendUrl)}/logo.png" alt="FETUILS TechHub" height="40" style="display:block;height:40px;border:0;margin-bottom:18px;">
  ${paragraphs}
</div></body></html>`;
}
