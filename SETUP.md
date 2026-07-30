# VisualPH Setup

## Current Project

- Supabase project ref: `zhmybmdcigjfpyiukbjp`
- Supabase URL: `https://zhmybmdcigjfpyiukbjp.supabase.co`

## Required Private Values

Fill these in locally in `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=
PH_API_TOKEN=
SYNC_SECRET=
```

Generate `SYNC_SECRET` with `openssl rand -hex 32`. Do not commit or share any
of these private values.

## Push Schema

Authenticate the Supabase CLI, then link and push:

```bash
npx supabase login
npx supabase link --project-ref zhmybmdcigjfpyiukbjp
npx supabase db push
```

The migration creates `public.products` and the public `screenshots` storage bucket.

## First Data Load

After `.env.local` contains `SUPABASE_SERVICE_ROLE_KEY` and `PH_API_TOKEN`, start the app and fetch Product Hunt launches:

```bash
npm run dev
```

```bash
curl -X POST "http://127.0.0.1:3001/api/fetch-products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SYNC_SECRET" \
  -d "{\"date\":\"2026-06-28\"}"
```

Then run screenshots:

```bash
npm run screenshot -- --all
```

## GitHub Actions secrets

Configure these repository secrets before enabling the daily workflow:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PH_API_TOKEN`
- `SYNC_SECRET`

The same `SYNC_SECRET` must be configured in the deployed application.
