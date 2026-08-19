type ScreenshotResult = {
  captureStatus: "captured" | "fallback";
};

export function selectProductMediaUrl(sourcePayload: unknown) {
  if (!sourcePayload || typeof sourcePayload !== "object") {
    return null;
  }

  const media = (sourcePayload as { media?: unknown }).media;
  if (!Array.isArray(media)) {
    return null;
  }

  for (const item of media) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const url = (item as { url?: unknown }).url;
    if (typeof url !== "string") {
      continue;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      // Ignore malformed Product Hunt media URLs.
    }
  }

  return null;
}

export function summarizeScreenshotBatch(results: ScreenshotResult[]) {
  const failed = results.filter((result) => result.captureStatus === "fallback").length;
  const processed = results.length;

  return {
    failed,
    processed,
    status:
      processed === 0
        ? ("empty" as const)
        : failed === processed
          ? ("failed" as const)
          : failed > 0
            ? ("partial" as const)
            : ("success" as const)
  };
}
