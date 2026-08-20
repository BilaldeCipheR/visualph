import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../lib/products.ts", import.meta.url), "utf8");

test("product list cache refreshes quickly after screenshot backfills", () => {
  assert.match(source, /visualph-products-by-date-v2/);
  assert.match(source, /revalidate: 60/);
  assert.doesNotMatch(source, /revalidate: 60 \* 60/);
});
