import assert from "node:assert/strict";
import test from "node:test";

import {
  differenceInUtcDays,
  isScreenshotCoverageHealthy,
  isSyncFresh
} from "../lib/health.ts";

test("differenceInUtcDays compares calendar days in UTC", () => {
  assert.equal(differenceInUtcDays("2026-08-09", "2026-08-11T23:59:59.000Z"), 2);
});

test("sync freshness allows the configured lag", () => {
  assert.equal(isSyncFresh("2026-08-09", "2026-08-11T12:00:00.000Z", 2), true);
  assert.equal(isSyncFresh("2026-08-08", "2026-08-11T12:00:00.000Z", 2), false);
  assert.equal(isSyncFresh(null, "2026-08-11T12:00:00.000Z", 2), false);
});

test("screenshot health requires complete coverage for the latest launch date", () => {
  assert.equal(isScreenshotCoverageHealthy(10, 0), true);
  assert.equal(isScreenshotCoverageHealthy(10, 1), false);
  assert.equal(isScreenshotCoverageHealthy(0, 0), false);
});
