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
  assert.match(filter, /screenshot_bytes\.lt\.20000/);
  assert.match(filter, /screenshot_captured_at\.lt\.2026-08-04T12:00:00\.000Z/);
});

test("refresh age rejects invalid values", () => {
  assert.throws(() => screenshotRefreshCutoff(0), /positive integer/);
});
