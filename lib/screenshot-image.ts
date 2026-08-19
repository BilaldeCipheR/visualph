import sharp from "sharp";

export const SCREENSHOT_CONTENT_TYPE = "image/webp";
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_MAX_WIDTH = 1440;
export const SCREENSHOT_MAX_HEIGHT = 9000;

export async function optimizeScreenshot(input: Buffer) {
  if (input.byteLength === 0) {
    throw new Error("Cannot optimize an empty screenshot.");
  }

  for (const candidate of [
    { quality: 78, width: SCREENSHOT_MAX_WIDTH },
    { quality: 65, width: 1200 },
    { quality: 52, width: 960 }
  ]) {
    const { data, info } = await sharp(input, { failOn: "warning" })
      .rotate()
      .resize({
        width: candidate.width,
        height: SCREENSHOT_MAX_HEIGHT,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ effort: 5, quality: candidate.quality })
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) {
      throw new Error("Optimized screenshot has invalid dimensions.");
    }

    if (data.byteLength <= SCREENSHOT_MAX_BYTES) {
      return {
        buffer: data,
        bytes: data.byteLength,
        contentType: SCREENSHOT_CONTENT_TYPE,
        height: info.height,
        width: info.width
      };
    }
  }

  throw new Error("Optimized screenshot exceeds 5 MB after compression retries.");
}
