# F&B - Friends and Benefits

F&B is a lightweight shared debt tracker for friends.

The fastest MVP is:

- `Next.js` web app
- `Supabase` for Google login, database, and real-time updates
- `Vercel` for deployment
- Mobile-first responsive UI so friends can use it like an app from their phones

This repo contains a starter scaffold plus the core product model so we can move quickly.

## MVP Features

- **Dual-Consent Approval Flow**: All debts and settlements require both parties to agree before affecting balances.
- **Shared Items Tracker**: Track things you've lent or borrowed (e.g., books, tools, expensive gear) with a full Request-Return lifecycle.
- **Pairwise Balances**: See exactly who owes what in a clean, high-contrast dashboard.
- **Global Approvals**: Manage all pending requests (money or items) in a single unified view.
- **Atmospheric UI**: Immersive, Ghibli-inspired animated waterfall landing page.
- **Play Store Ready**: Optimized for conversion into a native Android app using Capacitor.

## Why this stack

- Fastest setup for auth + database
- Easy Google OAuth
- Easy deploy
- One codebase works on desktop and mobile
- Real-time updates are built in

## Recommended product scope for launch

Launch these first:

1. Google login
2. Friend invite
3. Create debt record
4. Approve debt
5. Mark as settled
6. Pairwise balance screen

Do not block launch on in-app payments.

Direct payments inside the app are possible later, but they add payment gateway, compliance, refund, and webhook complexity. For a quick release, track manual settlements first. After people are using it, add gateway-based settlements.

## Folder Guide

- `app/` Next.js app router pages
- `lib/` product constants and starter data model notes
- `supabase/schema.sql` database schema for the MVP
- `.env.example` required environment variables

## Quick Start

1. Create a Supabase project
2. Enable Google auth in Supabase
3. Run the SQL in `supabase/schema.sql`
4. Copy `.env.example` to `.env.local`
5. Install packages with `npm install`
6. Start locally with `npm run dev`
7. Deploy to Vercel

## Deployment & Publishing

### Web (Vercel)
- App hosting: Vercel
- Database and auth: Supabase
- Deployment guide: `DEPLOY.md`

### Mobile (Google Play Store)
This app is designed to be wrapped as a **TWA (Trusted Web Activity)** or using **Capacitor**.

1. **Install Capacitor**: `npm i @capacitor/core @capacitor/cli @capacitor/android`
2. **Initialize**: `npx cap init`
3. **Build Web Assets**: `npm run build`
4. **Sync Native App**: `npx cap sync android`
5. **Publish**: Use Android Studio to generate the `.aab` file for the Google Play Console.
6. **Icons**: Use the provided `/public/fnb-logo.svg` for your high-res store assets.

## Product Notes

- Every debt starts as `pending`
- The other friend must approve it before it affects the balance
- Approved records create ledger impact
- Settlements reduce outstanding balance
- Keep an immutable activity trail for trust between friends

## Best next step

Build the authenticated app shell, then wire Supabase auth and debt creation flow first.
