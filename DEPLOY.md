# Deploying F&B

This guide gets F&B running locally and then live on Vercel with Supabase and Google sign-in.

## 1. Create the Supabase project

1. Create a new project in Supabase.
2. Open the SQL editor.
3. Run the schema from `supabase/schema.sql`.
4. Copy your project URL and anon key from `Project Settings -> API`.

## 2. Configure Google sign-in in Supabase

1. In Supabase, open `Authentication -> Sign In / Providers`.
2. Open the Google provider.
3. Copy the Supabase callback URL shown there. It will look like:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
4. Keep that page open because you will paste your Google OAuth credentials there.

## 3. Create Google OAuth credentials

1. Open Google Cloud Console.
2. Create a project or choose an existing one.
3. Configure the OAuth consent screen.
4. Create an OAuth client of type `Web application`.
5. Add these Authorized redirect URIs:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
6. For local testing, also add:
   `http://localhost:3000`
   This app redirects back to the app origin after Supabase completes auth.
7. Copy the Google client ID and client secret.
8. Paste them into the Google provider settings in Supabase and enable the provider.

## 4. Configure Supabase redirect URLs

In Supabase, open `Authentication -> URL Configuration`.

Set:

- `Site URL`: `http://localhost:3000` for local development first
- `Redirect URLs` allow list:
  - `http://localhost:3000/**`
  - `https://YOUR-PROJECT-NAME.vercel.app/**`
  - `https://*-YOUR-PROJECT-NAME.vercel.app/**`

After you add your real production domain, add that too:

- `https://your-domain.com/**`

The wildcard Vercel entry is important because preview deployments use changing URLs.

## 5. Create local env vars

Create `.env.local` from `.env.example`.

Use values like:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## 6. Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 7. Deploy to Vercel

### Dashboard path

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Add these environment variables in Vercel for `Production`, `Preview`, and `Development`:
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. For production, set:
   - `NEXT_PUBLIC_SITE_URL=https://YOUR-PROJECT-NAME.vercel.app`
5. Deploy.

### CLI path

Install the Vercel CLI, then from the repo root run:

```powershell
vercel
```

After the first deploy, add the same environment variables in the Vercel dashboard or with the CLI and redeploy.

## 8. Final production auth pass

After Vercel gives you a production URL:

1. Add the production URL to Supabase `Site URL` if that will be the main domain.
2. Keep the preview wildcard in `Redirect URLs`.
3. Add the production URL and any custom domain to the allow list:
   - `https://YOUR-PROJECT-NAME.vercel.app/**`
   - `https://your-domain.com/**`
4. In Google Cloud, make sure the Supabase callback URL is still present.
   You usually do not need to change this unless the Supabase project changes.

## 9. Launch checklist

- Sign in with Google on localhost
- Create your username
- Invite a friend
- Accept invite from another account
- Create a debt request
- Approve it from the other account
- Record a settlement
- Confirm balances update correctly
- Repeat the same flow on the deployed Vercel URL

## Notes

- The app currently supports manual settlement tracking, not in-app money transfer.
- The easiest way to share this quickly is as a mobile-friendly website.
- If you want native apps later, we can wrap this with React Native or Expo after the web version is stable.
