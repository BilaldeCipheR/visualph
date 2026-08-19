import assert from "node:assert/strict";
import test from "node:test";

import { attemptScreenshotUpload } from "../lib/screenshot-upload.ts";

test("attemptScreenshotUpload returns a successful upload value", async () => {
  assert.deepEqual(await attemptScreenshotUpload(async () => "public-url"), {
    ok: true,
    value: "public-url"
  });
});

test("attemptScreenshotUpload converts an upload error into a failed result", async () => {
  const error = new Error("mime type is not supported");

  assert.deepEqual(
    await attemptScreenshotUpload(async () => {
      throw error;
    }),
    { error, ok: false }
  );
});
