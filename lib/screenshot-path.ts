type ScreenshotPathInput = {
  contentType?: string;
  launchDate: string;
  pathPrefix: string;
  productId: string;
  slug: string;
};

const LAUNCH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function buildScreenshotStoragePath(input: ScreenshotPathInput) {
  const {
    contentType = "image/png",
    launchDate,
    pathPrefix,
    productId,
    slug
  } = input;

  if (!LAUNCH_DATE_PATTERN.test(launchDate)) {
    throw new Error(`Invalid product launch date: ${launchDate || "missing"}`);
  }

  const safeSlug = sanitizePathPart(slug || productId);
  return `${pathPrefix}/${launchDate}/${safeSlug}/latest.${extensionForContentType(contentType)}`;
}

function extensionForContentType(contentType: string) {
  switch (contentType) {
    case "image/avif":
      return "avif";
    case "image/gif":
      return "gif";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

function sanitizePathPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "product";
}
