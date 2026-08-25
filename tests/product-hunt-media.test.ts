import assert from "node:assert/strict";
import test from "node:test";

import { selectProductThumbnailUrl } from "../lib/product-hunt/fetch-products.ts";

test("selectProductThumbnailUrl chooses the first valid HTTPS image", () => {
  assert.equal(
    selectProductThumbnailUrl([
      { type: "video", url: "https://cdn.example.com/demo.mp4" },
      { type: "image", url: "https://cdn.example.com/cover.png" },
      { type: "image", url: "https://cdn.example.com/second.png" }
    ]),
    "https://cdn.example.com/cover.png"
  );
});

test("selectProductThumbnailUrl rejects non-image and insecure URLs", () => {
  assert.equal(
    selectProductThumbnailUrl([
      { type: "image", url: "http://cdn.example.com/cover.png" },
      { type: "video", url: "https://cdn.example.com/demo.mp4" }
    ]),
    null
  );
});
