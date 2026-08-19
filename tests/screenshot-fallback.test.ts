import assert from "node:assert/strict";
import test from "node:test";

import {
  selectProductMediaUrl,
  summarizeScreenshotBatch
} from "../lib/screenshot-fallback.ts";

test("selectProductMediaUrl returns the first secure Product Hunt media URL", () => {
  assert.equal(
    selectProductMediaUrl({
      media: [
        { type: "image", url: "http://insecure.example/image.png" },
        { type: "image", url: "https://ph-files.imgix.net/launch.png" }
      ]
    }),
    "https://ph-files.imgix.net/launch.png"
  );
});

test("selectProductMediaUrl rejects missing and malformed media", () => {
  assert.equal(selectProductMediaUrl(null), null);
  assert.equal(selectProductMediaUrl({ media: [{ url: "not-a-url" }] }), null);
});

test("summarizeScreenshotBatch fails only when every processed capture fails", () => {
  assert.deepEqual(summarizeScreenshotBatch([]), {
    failed: 0,
    processed: 0,
    status: "empty"
  });
  assert.equal(
    summarizeScreenshotBatch([{ captureStatus: "fallback" }]).status,
    "failed"
  );
  assert.equal(
    summarizeScreenshotBatch([
      { captureStatus: "captured" },
      { captureStatus: "fallback" }
    ]).status,
    "partial"
  );
});
