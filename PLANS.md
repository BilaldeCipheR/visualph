# VisualPH Clone Plan

## Build Order

1. Scaffold the Next.js 14 App Router project structure and shared configuration.
2. Add the Supabase schema and storage setup for products and screenshots.
3. Build the Product Hunt fetch API route and shared Supabase helpers.
4. Build the Puppeteer screenshot pipeline script and storage upload flow.
5. Build the main UI for browsing launches with filters and sorting.
6. Add the daily GitHub Actions workflow that runs fetch and screenshot generation at `00:05` UTC.
7. Integrate environment variables, shared types, and data flow across the layers.
8. Verify with `npm run build` and fix any type or build errors.

## Parallel Delegation

- DB subagent: `supabase/` schema and storage provisioning files only.
- API subagent: `app/api/fetch-products/route.ts` and API-local helpers only.
- Screenshot subagent: `scripts/screenshot.ts` and screenshot-local helpers only.
- UI subagent: `app/page.tsx` and UI-only components only.
- CI subagent: `.github/workflows/daily.yml` only.

## Integration Notes

- Keep all React components under `/components`.
- Keep all API routes under `/app/api`.
- Use Supabase Storage bucket `screenshots`.
- Use the Product Hunt GraphQL endpoint `https://api.producthunt.com/v2/api/graphql`.
- Assume `PH_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided at runtime.
- Favor build-safe placeholders and server-side fallbacks so the UI renders even when external data is missing.
