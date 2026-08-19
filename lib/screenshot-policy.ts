export const DEFAULT_SCREENSHOT_REFRESH_AFTER_DAYS = 30;
export const MIN_SCREENSHOT_BYTES = 2_000;

export function screenshotRefreshCutoff(days: number, now = new Date()) {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error("Screenshot refresh age must be a positive integer.");
  }

  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function screenshotCandidateFilter(
  refreshAfterDays: number,
  now = new Date(),
  includeLegacyFormats = false
) {
  const cutoff = screenshotRefreshCutoff(refreshAfterDays, now);
  const candidates = [
    "screenshot_status.eq.pending",
    "screenshot_status.eq.fallback",
    "screenshot_path.is.null",
    "screenshot_url.is.null",
    `screenshot_bytes.lt.${MIN_SCREENSHOT_BYTES}`,
    "screenshot_captured_at.is.null",
    `screenshot_captured_at.lt.${cutoff}`
  ];

  if (includeLegacyFormats) {
    candidates.push("screenshot_path.not.ilike.%.webp");
  }

  return candidates.join(",");
}
