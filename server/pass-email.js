import QRCode from 'qrcode';

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const NAVY = '#0B1F3F';
const ORANGE = '#E8481C';
const FONT = 'font-family:Arial,Helvetica,sans-serif;';

export const passCode = (reference) => `FET-${String(reference).replace(/^fet_/, '').slice(0, 8).toUpperCase()}`;

const formatDate = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Drawn as table cells, not an image: many inboxes block images by default,
// and the pass has to show at the door even with poor connectivity.
function qrTable(text) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const CELL = 4;
  let rows = '';
  for (let y = 0; y < modules.size; y++) {
    let cells = '';
    for (let x = 0; x < modules.size; x++) {
      cells += modules.get(y, x) ? `<td width="${CELL}" bgcolor="${NAVY}"></td>` : `<td width="${CELL}"></td>`;
    }
    rows += `<tr height="${CELL}">${cells}</tr>`;
  }
  const size = modules.size * CELL;
  return `<table role="img" aria-label="Pass QR code" width="${size}" height="${size}" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border-collapse:collapse;font-size:0;line-height:0;margin:0 auto;">${rows}</table>`;
}

const field = (label, value) => `
  <div style="${FONT}font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">${label}</div>
  <div style="${FONT}font-size:15px;font-weight:bold;color:${NAVY};padding:4px 0 16px;">${value}</div>`;

export function passEmailHtml({ booking, frontendUrl }) {
  const reference = booking.paystack_reference;
  const passUrl = `${frontendUrl}/booking/confirmation?reference=${encodeURIComponent(reference)}`;
  const date = booking.metadata?.booking_date;
  const validUntil = booking.metadata?.valid_until;
  const validText = date
    ? validUntil && validUntil !== date
      ? `${formatDate(date)} – ${formatDate(validUntil)}`
      : formatDate(date)
    : 'See booking';
  const amount = `₦${Number(booking.amount).toLocaleString('en-NG')}`;

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9"><tr><td align="center" style="padding:28px 12px;">
  <p style="${FONT}font-size:15px;color:#334155;margin:0 0 18px;max-width:400px;">Hi ${escapeHtml(booking.full_name)}, your payment is confirmed. <strong>Show this pass at the hub entrance.</strong></p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:400px;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="padding:14px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><img src="${escapeHtml(frontendUrl)}/logo.png" alt="FETUILS TechHub" height="44" style="display:block;height:44px;border:0;${FONT}font-weight:bold;color:${NAVY};"></td>
        <td align="right" style="${FONT}font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;">Hub Pass</td>
      </tr></table>
    </td></tr>
    <tr><td bgcolor="${NAVY}" style="padding:22px;border-bottom:4px solid ${ORANGE};">
      <div style="${FONT}font-size:11px;font-weight:bold;color:#6ee7b7;letter-spacing:1px;text-transform:uppercase;">Paid</div>
      <div style="${FONT}font-size:22px;font-weight:bold;color:#ffffff;padding-top:6px;">${escapeHtml(booking.plan_title)}</div>
    </td></tr>
    <tr><td style="padding:20px 22px 4px;">
      ${field('Pass holder', escapeHtml(booking.full_name))}
      ${field(validUntil && validUntil !== date ? 'Valid' : 'Date', escapeHtml(validText))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="50%" valign="top">${field('Amount paid', amount)}</td>
        <td width="50%" valign="top">${field('Location', 'FET, UNILORIN')}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 22px;"><div style="border-top:2px dashed #e2e8f0;font-size:0;line-height:0;">&nbsp;</div></td></tr>
    <tr><td align="center" style="padding:22px;">
      ${qrTable(passUrl)}
      <div style="${FONT}font-size:17px;font-weight:bold;letter-spacing:3px;color:${NAVY};padding-top:14px;">${escapeHtml(passCode(reference))}</div>
      <div style="${FONT}font-size:12px;color:#64748b;padding-top:6px;">Show this pass at the hub entrance</div>
    </td></tr>
  </table>
  <p style="${FONT}font-size:13px;margin:18px 0 0;"><a href="${escapeHtml(passUrl)}" style="color:${ORANGE};font-weight:bold;">Open your pass online</a></p>
  <p style="${FONT}font-size:12px;color:#64748b;margin:10px 0 0;">Faculty of Engineering &amp; Technology, University of Ilorin</p>
</td></tr></table>
</body></html>`;
}
