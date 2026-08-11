import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_MAX_SYNC_LAG_DAYS,
  differenceInUtcDays,
  isSyncFresh
} from "@/lib/health";
import { DEFAULT_SCREENSHOT_REFRESH_AFTER_DAYS } from "@/lib/screenshot-policy";

export const dynamic = "force-dynamic";

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

    const latestLaunchDate = data?.latest_launch_date ? String(data.latest_launch_date) : null;
    const lagDays = latestLaunchDate ? differenceInUtcDays(latestLaunchDate, checkedAt) : null;
    const syncFresh = isSyncFresh(latestLaunchDate, checkedAt, DEFAULT_MAX_SYNC_LAG_DAYS);

    return NextResponse.json(
      {
        ok: syncFresh,
        checkedAt,
        database: "reachable",
        productCount: data?.total_products ?? 0,
        latestLaunchDate,
        sync: {
          status: syncFresh ? "healthy" : "stale",
          lagDays,
          maxLagDays: DEFAULT_MAX_SYNC_LAG_DAYS
        },
        screenshots: {
          missing: data?.missing_screenshots ?? 0,
          stale: data?.stale_screenshots ?? 0,
          undersized: data?.undersized_screenshots ?? 0,
          latestCapturedAt: data?.last_screenshot_captured_at ?? null
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
