import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  optimizeScreenshot,
  SCREENSHOT_CONTENT_TYPE,
  SCREENSHOT_MAX_BYTES
} from "../lib/screenshot-image.ts";

test("screenshot images are normalized to bounded WebP output", async () => {
  const png = await sharp({
    create: {
      background: { alpha: 1, b: 20, g: 80, r: 220 },
      channels: 4,
      height: 1600,
      width: 2000
    }
  }).png().toBuffer();

  const optimized = await optimizeScreenshot(png);
  const metadata = await sharp(optimized.buffer).metadata();

  assert.equal(optimized.contentType, SCREENSHOT_CONTENT_TYPE);
  assert.equal(metadata.format, "webp");
  assert.equal(optimized.width, 1440);
  assert.ok(optimized.bytes < SCREENSHOT_MAX_BYTES);
});

test("empty screenshot input is rejected", async () => {
  await assert.rejects(() => optimizeScreenshot(Buffer.alloc(0)), /empty screenshot/);
});
