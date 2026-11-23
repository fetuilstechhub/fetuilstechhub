// Prices are set here on the server. Never trust an amount sent by the browser.
// Keep in sync with src/lib/plans.ts (server/test/api.test.js checks this).
//   days: how long the pass lasts
//   entriesPerDay: how many times the pass opens the door each day
//   photo: guard photographs the holder at first entry and compares on later days
export const PLANS = {
  daily: { title: 'The Daily Pass', price: 1000, days: 1, entriesPerDay: 1, photo: false },
  weekly: { title: 'The Weekly Plan', price: 6500, days: 7, entriesPerDay: 1, photo: true },
  monthly: { title: 'Monthly / Semester Plan', price: 20000, days: 30, entriesPerDay: 1, photo: true },
  team_startup: { title: "The 'Team/Startup' Bundle", price: 20000, days: 30, entriesPerDay: 5, photo: false },
  studio_standard: { title: 'Standard Studio Session', price: 5000, days: 1, entriesPerDay: 1, photo: false },
  photoshoot: { title: 'Professional Photoshoot', price: 3000, days: 1, entriesPerDay: 1, photo: false },
  // Confirms the organiser's payment. The team on duty looks after their guests.
  event_hall: { title: 'Event Hall', price: 50000, days: 1, entriesPerDay: 1, photo: false },
};

// Last day the pass is valid, as YYYY-MM-DD.
export function validUntil(startDate, planId) {
  const end = new Date(`${startDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + PLANS[planId].days - 1);
  return end.toISOString().slice(0, 10);
}
