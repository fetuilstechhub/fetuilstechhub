# Core team selection (temporary)

A private screening tool for the 2026 core team call, at `/selection`. Team leads sign in with a
shared team login, review their team's applicants one at a time, score them, and message the ones
selected for the next phase by WhatsApp, email or copy.

## Set up (once)

1. Run `supabase/selection.sql` in the Supabase SQL editor.
2. In Render, add:
   - `SELECTION_ADMIN_EMAIL`: the main admin login, e.g. `lead@hub.local` (doesn't need a real inbox)
   - `SELECTION_ADMIN_PASSWORD`: at least 12 characters
3. Open `/selection`, sign in as the admin, go to **Import** and upload the responses sheet
   (Google Sheets: File > Download > Comma-separated values).
4. Go to **Logins** and create one login per team (and an admin one for the Co-lead).
   Send each password privately to that team's leads.

## Security

- Passwords are stored as scrypt hashes. Nobody can read one back; you can only set a new one.
- Wrong passwords: 10 per address and 40 across all devices per 15 minutes.
- A team login only ever receives its own teams' applicants from the server. Matric numbers go to admins only.
- A new password, switching a login off, or changing its teams signs out every device using it.
  Changing `SELECTION_ADMIN_PASSWORD` in Render signs the main admin out everywhere.
- The tables have row level security on with no policies, so only the server can read them.

## Remove it when selection is over

1. Export anything you want to keep (Applicants > Export).
2. Delete `server/selection/`, `src/selection/` and `server/test/selection.test.js`.
3. Remove the two lines marked "Core team selection" in `server/index.js`, and the two in `src/App.tsx`.
4. Remove `test/selection.test.js` from the test script in `server/package.json`,
   and `Disallow: /selection` from `public/robots.txt`.
5. Run `supabase/selection-remove.sql` in Supabase, then delete it and `supabase/selection.sql`.
6. Remove `SELECTION_ADMIN_EMAIL` and `SELECTION_ADMIN_PASSWORD` from Render.

The `sel_` entries in `server/test/fake-services.js` are harmless to leave.
