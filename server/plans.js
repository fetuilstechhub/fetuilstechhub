// Prices are set here on the server. Never trust an amount sent by the browser.
// Keep in sync with src/lib/plans.ts (server/test/api.test.js checks this).
export const PLANS = {
  daily: { title: 'The Daily Pass', price: 1500, days: 1 },
  weekly: { title: 'The Weekly Plan', price: 6500, days: 7 },
  monthly: { title: 'Monthly / Semester Plan', price: 20000, days: 30 },
  team_startup: { title: "The 'Team/Startup' Bundle", price: 20000, days: 30 },
  studio_standard: { title: 'Standard Studio Session', price: 5000, days: 1 },
  photoshoot: { title: 'Professional Photoshoot', price: 3000, days: 1 },
};

// Last day the pass is valid, as YYYY-MM-DD.
export function validUntil(startDate, planId) {
  const end = new Date(`${startDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + PLANS[planId].days - 1);
  return end.toISOString().slice(0, 10);
}
