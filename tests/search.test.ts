import assert from "node:assert/strict";
import test from "node:test";

import {
  matchTier,
  matchesQuery,
  queryWords,
  type SearchableLaunch
} from "../lib/search.ts";

const launch: SearchableLaunch = {
  name: "Visual Product Hunt",
  tagline: "Discover useful developer tools",
  category: "Productivity",
  topic: "Design Tools",
  description: "A searchable archive for makers and founders"
};

test("name matches receive tier 3", () => {
  assert.equal(matchTier(launch, "  VISUAL   hunt "), 3);
});

test("tagline matches receive tier 2", () => {
  assert.equal(matchTier(launch, "developer"), 2);
});

test("category and topic matches receive tier 2", () => {
  assert.equal(matchTier(launch, "productivity design"), 2);
});

test("description-only matches receive tier 1", () => {
  assert.equal(matchTier(launch, "makers"), 1);
});

test("multi-word queries require every token", () => {
  assert.equal(matchesQuery(launch, "visual founders"), true);
  assert.equal(matchesQuery(launch, "visual missing"), false);
});

test("unmatched queries receive tier 0", () => {
  assert.equal(matchTier(launch, "accounting"), 0);
  assert.equal(matchesQuery(launch, "accounting"), false);
});

test("blank queries are whitespace-safe and match every launch", () => {
  assert.deepEqual(queryWords(" \n\t "), []);
  assert.equal(matchesQuery(launch, " \n\t "), true);
});
