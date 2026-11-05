# FETUILS TechHub

Website for FETUILS TechHub, the technology hub at the University of Ilorin. Visitors can browse services and training, and book and pay for workspace passes and studio sessions.

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS and shadcn/ui, hosted on Vercel
- **Backend:** Express API in `server/`, hosted on Render
- **Services:** Supabase (bookings database), Paystack (payments), Resend (email)

## Local setup

Requires Node.js and npm.

### Frontend

```bash
npm install
npm run dev
```

The dev server runs on http://localhost:8080.

Create `.env.local` in the project root:

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL of the API, for example `http://localhost:8787` |

### Backend

```bash
cd server
npm install
npm start
```

The API runs on http://localhost:8787.

Create `server/.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (defaults to 8787) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `PAYMENT_MODE` | Leave unset for bank transfers via WhatsApp. Set to `paystack` once Paystack is live |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (server only). Only needed when `PAYMENT_MODE` is `paystack` |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Sender address for booking emails |
| `FRONTEND_URL` | Site URL that Paystack returns customers to |
| `STAFF_PIN` | PIN for the door scanner at `/door` and the payments page at `/door/payments`, at least 6 characters. Changing it signs out every phone |

Never commit real keys. `.env` and `.env.local` files are ignored by git.

### Database

Run `supabase/schema.sql` in the Supabase SQL editor to create the `bookings` table.

### Taking payments

By default, customers book on the site, then finish on WhatsApp and pay by bank transfer. Staff confirm each transfer at `/door/payments`, which emails the pass.

To switch to Paystack, set `PAYMENT_MODE=paystack` and `PAYSTACK_SECRET_KEY` on the API, set `VITE_PAYMENT_MODE=paystack` on the frontend, and redeploy both.

### Paystack webhook

In the Paystack dashboard, set the webhook URL to `<API URL>/api/webhook`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
