# F&B - Friends and Benefits

F&B is a lightweight shared debt tracker for friends.

The fastest MVP is:

- `Next.js` web app
- `Supabase` for Google login, database, and real-time updates
- `Vercel` for deployment
- Mobile-first responsive UI so friends can use it like an app from their phones

This repo contains a starter scaffold plus the core product model so we can move quickly.

## MVP Features

- Google-only sign in
- Add friends by invite
- Create a debt request with amount, reason, date, and optional due date
- Debtor approves or rejects the request
- Running balance between every pair of friends
- Settlement entries to mark money returned
- Activity feed for trust and auditability

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

## Deployment

- App hosting: Vercel
- Database and auth: Supabase
- Domain: optional custom domain once the app is stable
- Full setup guide: `DEPLOY.md`

## Product Notes

- Every debt starts as `pending`
- The other friend must approve it before it affects the balance
- Approved records create ledger impact
- Settlements reduce outstanding balance
- Keep an immutable activity trail for trust between friends

## Best next step

Build the authenticated app shell, then wire Supabase auth and debt creation flow first.
