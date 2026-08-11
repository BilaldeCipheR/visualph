import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_MAX_SYNC_LAG_DAYS,
  differenceInUtcDays,
  isSyncFresh
} from "@/lib/health";
import { DEFAULT_SCREENSHOT_REFRESH_AFTER_DAYS } from "@/lib/screenshot-policy";

export const dynamic = "force-dynamic";

type ProductsHealthSummary = {
  last_screenshot_captured_at: string | null;
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
      .rpc("products_health_summary", {
        p_refresh_after_days: DEFAULT_SCREENSHOT_REFRESH_AFTER_DAYS
      })
      .single();

    if (error) {
      throw error;
    }

    const summary = toProductsHealthSummary(data);
    const latestLaunchDate = summary?.latest_launch_date ? String(summary.latest_launch_date) : null;
    const lagDays = latestLaunchDate ? differenceInUtcDays(latestLaunchDate, checkedAt) : null;
    const syncFresh = isSyncFresh(latestLaunchDate, checkedAt, DEFAULT_MAX_SYNC_LAG_DAYS);

    return NextResponse.json(
      {
        ok: syncFresh,
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
          missing: summary?.missing_screenshots ?? 0,
          stale: summary?.stale_screenshots ?? 0,
          undersized: summary?.undersized_screenshots ?? 0,
          latestCapturedAt: summary?.last_screenshot_captured_at ?? null
        }
      },
      {
        status: syncFresh ? 200 : 503,
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

function toProductsHealthSummary(value: unknown): ProductsHealthSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as ProductsHealthSummary;
}
