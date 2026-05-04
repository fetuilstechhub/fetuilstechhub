# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/09a14ae7-bd4a-415b-b22e-66bbeb1a9240

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/09a14ae7-bd4a-415b-b22e-66bbeb1a9240) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/09a14ae7-bd4a-415b-b22e-66bbeb1a9240) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Booking & Payments (Supabase + Paystack + Resend)

This repo now includes a scaffold for bookings and payments using Supabase for persistence, Paystack for payments, and Resend for transactional emails.

Files added:
- `supabase/schema.sql`: SQL to create the `bookings` table.
- `server/`: Express-based API that initializes Paystack transactions and handles Paystack webhooks; persisting bookings to Supabase and sending emails via Resend.
- `src/pages/Booking.tsx`: Booking form that calls the server to initialize payments.
- `src/components/OrderSummary.tsx`: Small order summary UI used on the booking page.
- `src/lib/plans.ts`: Shared plans/pricing used by the booking page.
- `.env.local.example` and `server/.env.example`: env var templates.

Quick start (local):

1. Copy env templates and fill real keys.

Server:

```bash
cd server
cp .env.example .env
# fill .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY, RESEND_API_KEY, FRONTEND_URL
npm install
npm run start
```

Frontend:

```bash
cp .env.local.example .env.local
# set VITE_API_BASE_URL to your server URL
npm run dev
```

Important:
- Fill Supabase `bookings` table by running `supabase/schema.sql` in your Supabase SQL editor.
- Add your Paystack webhook endpoint (`/api/webhook`) to your Paystack dashboard and set the webhook secret accordingly.
- Store secrets safely (do NOT commit real keys).

