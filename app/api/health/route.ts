import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_MAX_SYNC_LAG_DAYS,
  differenceInUtcDays,
  isSyncFresh
} from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw error;
    }

    const { data: latest, error: latestError } = await supabase
      .from("products")
      .select("launch_date")
      .order("launch_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw latestError;
    }

    const latestLaunchDate = latest?.launch_date ? String(latest.launch_date) : null;
    const lagDays = latestLaunchDate ? differenceInUtcDays(latestLaunchDate, checkedAt) : null;
    const syncFresh = isSyncFresh(latestLaunchDate, checkedAt, DEFAULT_MAX_SYNC_LAG_DAYS);

    const { count: missingScreenshotCount, error: screenshotCountError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .is("screenshot_url", null);

    if (screenshotCountError) {
      throw screenshotCountError;
    }

    const { data: latestScreenshot, error: latestScreenshotError } = await supabase
      .from("products")
      .select("screenshot_captured_at")
      .not("screenshot_captured_at", "is", null)
      .order("screenshot_captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestScreenshotError) {
      throw latestScreenshotError;
    }

    return NextResponse.json(
      {
        ok: syncFresh,
        checkedAt,
        database: "reachable",
        productCount: count ?? 0,
        latestLaunchDate,
        sync: {
          status: syncFresh ? "healthy" : "stale",
          lagDays,
          maxLagDays: DEFAULT_MAX_SYNC_LAG_DAYS
        },
        screenshots: {
          missing: missingScreenshotCount ?? 0,
          latestCapturedAt: latestScreenshot?.screenshot_captured_at ?? null
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
