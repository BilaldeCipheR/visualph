import assert from "node:assert/strict";
import test from "node:test";

import { differenceInUtcDays, isSyncFresh } from "../lib/health.ts";

test("differenceInUtcDays compares calendar days in UTC", () => {
  assert.equal(differenceInUtcDays("2026-08-09", "2026-08-11T23:59:59.000Z"), 2);
});

test("sync freshness allows the configured lag", () => {
  assert.equal(isSyncFresh("2026-08-09", "2026-08-11T12:00:00.000Z", 2), true);
  assert.equal(isSyncFresh("2026-08-08", "2026-08-11T12:00:00.000Z", 2), false);
  assert.equal(isSyncFresh(null, "2026-08-11T12:00:00.000Z", 2), false);
});
