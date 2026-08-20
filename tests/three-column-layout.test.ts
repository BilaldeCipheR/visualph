import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const explorerSource = readFileSync(
  new URL("../components/visualph/visualph-explorer.tsx", import.meta.url),
  "utf8"
);
const screenshotSource = readFileSync(
  new URL("../components/visualph/launch-screenshot.tsx", import.meta.url),
  "utf8"
);

test("launch grid uses one, two, and three responsive columns", () => {
  assert.match(explorerSource, /md:grid-cols-2 xl:grid-cols-3/);
  assert.match(explorerSource, /flex h-full flex-col overflow-hidden/);
});

test("tall screenshots remain uncropped and keyboard scrollable", () => {
  assert.match(screenshotSource, /overflow-y-auto/);
  assert.match(screenshotSource, /className="block h-auto w-full"/);
  assert.match(screenshotSource, /tabIndex=\{0\}/);
  assert.match(screenshotSource, /aria-label=\{`\$\{name\} screenshot preview`\}/);
});
