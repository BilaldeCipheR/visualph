import assert from "node:assert/strict";
import test from "node:test";

import { screenshotCandidateFilter, screenshotRefreshCutoff } from "../lib/screenshot-policy.ts";

test("screenshot refresh cutoff is age based", () => {
  assert.equal(
    screenshotRefreshCutoff(7, new Date("2026-08-11T12:00:00.000Z")),
    "2026-08-04T12:00:00.000Z"
  );
});

test("candidate filter includes missing, undersized, and stale screenshots", () => {
  const filter = screenshotCandidateFilter(7, new Date("2026-08-11T12:00:00.000Z"));
  assert.match(filter, /screenshot_url\.is\.null/);
  assert.match(filter, /screenshot_status\.eq\.pending/);
  assert.match(filter, /screenshot_status\.eq\.fallback/);
  assert.match(filter, /screenshot_bytes\.lt\.2000/);
  assert.match(filter, /screenshot_captured_at\.lt\.2026-08-04T12:00:00\.000Z/);
});

test("date backfill filter includes legacy non-WebP screenshots", () => {
  const filter = screenshotCandidateFilter(30, new Date("2026-09-03T12:00:00.000Z"), true);

  assert.match(filter, /screenshot_path\.not\.ilike\.%\.webp/);
});

test("refresh age rejects invalid values", () => {
  assert.throws(() => screenshotRefreshCutoff(0), /positive integer/);
});
