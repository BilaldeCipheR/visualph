import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const explorerSource = readFileSync(
  new URL("../components/visualph/visualph-explorer.tsx", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("date selection closes the controlled calendar before navigation", () => {
  assert.match(explorerSource, /open=\{calendarOpen\}/);
  assert.match(
    explorerSource,
    /setCalendarOpen\(false\);\s*handleDateChange\(format\(date, "yyyy-MM-dd"\)\)/
  );
});

test("date navigation preserves the explorer instead of forcing a remount", () => {
  assert.doesNotMatch(pageSource, /key=\{`\$\{selectedDate\}/);
});

test("calendar dates through today remain selectable", () => {
  assert.doesNotMatch(explorerSource, /availableDateSet/);
  assert.match(explorerSource, /disabled=\{\(date\) => date > new Date\(\)\}/);
});
