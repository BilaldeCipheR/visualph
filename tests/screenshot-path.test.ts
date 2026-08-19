import assert from "node:assert/strict";
import test from "node:test";

import { buildScreenshotStoragePath } from "../lib/screenshot-path.ts";

test("screenshot storage paths include the product launch date", () => {
  assert.equal(
    buildScreenshotStoragePath({
      launchDate: "2026-08-16",
      pathPrefix: "products",
      productId: "123",
      slug: "Example Product"
    }),
    "products/2026-08-16/example-product/latest.webp"
  );
});

test("storage paths are WebP regardless of the capture source", () => {
  assert.match(
    buildScreenshotStoragePath({
      launchDate: "2026-08-18",
      pathPrefix: "products",
      productId: "456",
      slug: "animated-fallback"
    }),
    /\/latest\.webp$/
  );
});

test("the same product on different launch dates receives different paths", () => {
  const buildPath = (launchDate: string) =>
    buildScreenshotStoragePath({
      launchDate,
      pathPrefix: "products",
      productId: "123",
      slug: "example-product"
    });

  assert.notEqual(buildPath("2026-08-16"), buildPath("2026-08-17"));
});

test("screenshot storage paths reject missing or malformed launch dates", () => {
  assert.throws(
    () =>
      buildScreenshotStoragePath({
        launchDate: "August 16",
        pathPrefix: "products",
        productId: "123",
        slug: "example-product"
      }),
    /Invalid product launch date/
  );
});
