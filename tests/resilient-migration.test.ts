import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const resilientMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260819153000_resilient_ingestion_and_screenshot_state.sql",
    import.meta.url
  ),
  "utf8"
);

const thumbnailMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260825090000_persist_product_hunt_thumbnail.sql",
    import.meta.url
  ),
  "utf8"
);

test("daily import upserts without replacing screenshot metadata", () => {
  assert.match(
    thumbnailMigration,
    /on conflict \(product_hunt_id, launch_date\) do update/i
  );
  assert.doesNotMatch(
    thumbnailMigration,
    /set[\s\S]*screenshot_url\s*=\s*excluded/i
  );
  assert.match(
    thumbnailMigration,
    /revoke all on function public\.replace_daily_products/i
  );
});

test("migration installs explicit screenshot state and WebP-only storage", () => {
  for (const column of [
    "screenshot_status",
    "screenshot_source",
    "screenshot_error",
    "screenshot_attempt_count",
    "screenshot_last_attempted_at"
  ]) {
    assert.match(resilientMigration, new RegExp(column));
  }

  assert.match(
    resilientMigration,
    /allowed_mime_types\s*=\s*array\['image\/webp'\]/i
  );
  assert.match(resilientMigration, /products_health_summary_v2/i);
});