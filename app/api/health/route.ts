import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_MAX_SYNC_LAG_DAYS,
  differenceInUtcDays,
  isScreenshotCoverageHealthy,
  isSyncFresh
} from "@/lib/health";
import {
  DEFAULT_SCREENSHOT_REFRESH_AFTER_DAYS,
  MIN_SCREENSHOT_BYTES
} from "@/lib/screenshot-policy";

export const dynamic = "force-dynamic";

type ProductsHealthSummary = {
  last_screenshot_captured_at: string | null;
  failed_screenshots: number;
  latest_launch_date: string | null;
  missing_screenshots: number;
  stale_screenshots: number;
  total_products: number;
  undersized_screenshots: number;
};

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .rpc("products_health_summary_v2", {
        p_refresh_after_days: DEFAULT_SCREENSHOT_REFRESH_AFTER_DAYS,
        p_min_screenshot_bytes: MIN_SCREENSHOT_BYTES
      })
      .single();

    if (error) {
      throw error;
    }

    const summary = toProductsHealthSummary(data);
    const latestLaunchDate = summary?.latest_launch_date ? String(summary.latest_launch_date) : null;
    const lagDays = latestLaunchDate ? differenceInUtcDays(latestLaunchDate, checkedAt) : null;
    const syncFresh = isSyncFresh(latestLaunchDate, checkedAt, DEFAULT_MAX_SYNC_LAG_DAYS);
    const latestProducts = latestLaunchDate
      ? await loadLatestScreenshotCoverage(supabase, latestLaunchDate)
      : [];
    const latestMissingScreenshotCount = latestProducts.filter(
      (product) => !product.screenshot_url
    ).length;
    const screenshotsHealthy = isScreenshotCoverageHealthy(
      latestProducts.length,
      latestMissingScreenshotCount
    );
    const healthy = syncFresh && screenshotsHealthy;

    return NextResponse.json(
      {
        ok: healthy,
        checkedAt,
        database: "reachable",
        productCount: summary?.total_products ?? 0,
        latestLaunchDate,
        sync: {
          status: syncFresh ? "healthy" : "stale",
          lagDays,
          maxLagDays: DEFAULT_MAX_SYNC_LAG_DAYS
        },
        screenshots: {
          status: screenshotsHealthy ? "healthy" : "incomplete",
          latestDateProductCount: latestProducts.length,
          latestDateMissing: latestMissingScreenshotCount,
          missing: summary?.missing_screenshots ?? 0,
          failed: summary?.failed_screenshots ?? 0,
          stale: summary?.stale_screenshots ?? 0,
          undersized: summary?.undersized_screenshots ?? 0,
          latestCapturedAt: summary?.last_screenshot_captured_at ?? null
        }
      },
      {
        status: healthy ? 200 : 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        checkedAt,
        database: "unreachable"
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}

async function loadLatestScreenshotCoverage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  latestLaunchDate: string
) {
  const { data, error } = await supabase
    .from("products")
    .select("screenshot_url")
    .eq("launch_date", latestLaunchDate);

  if (error) {
    throw error;
  }

  return data ?? [];
}

function toProductsHealthSummary(value: unknown): ProductsHealthSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as ProductsHealthSummary;
}
