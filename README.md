# VisualPH

VisualPH displays Product Hunt launches as product-website screenshots, ordered
by upvotes.

## Importing historical launches

Open **Actions → Daily VisualPH sync → Run workflow** in GitHub. Set
`backfill_days` to the number of days to import. The accepted range is 1–30.
Leave `start_date` blank to count backward from today, or enter a date such as
`2026-06-30` to import an older 30-day block.

For the first historical import, start with 30 days. The workflow imports every
day in the range and then captures screenshots for products that do not yet
have a valid image.

The scheduled daily run uses one day automatically.

## Screenshot retries

Failed captures are left without a stored image so future workflow runs retry
them. Legacy solid-color fallback images are detected by their small file size
and refreshed automatically.
