export const DEFAULT_MAX_SYNC_LAG_DAYS = 2;

export function differenceInUtcDays(left: string, right = new Date().toISOString()) {
  const leftTime = Date.parse(`${left.slice(0, 10)}T00:00:00.000Z`);
  const rightTime = Date.parse(`${right.slice(0, 10)}T00:00:00.000Z`);

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return null;
  }

  return Math.max(0, Math.floor((rightTime - leftTime) / 86_400_000));
}

export function isSyncFresh(latestLaunchDate: string | null, checkedAt: string, maxLagDays: number) {
  if (!latestLaunchDate) {
    return false;
  }

  const lagDays = differenceInUtcDays(latestLaunchDate, checkedAt);
  return lagDays !== null && lagDays <= maxLagDays;
}

export function isScreenshotCoverageHealthy(productCount: number, missingScreenshotCount: number) {
  return productCount > 0 && missingScreenshotCount === 0;
}
