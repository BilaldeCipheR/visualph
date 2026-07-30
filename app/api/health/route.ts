import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

    return NextResponse.json(
      {
        ok: true,
        checkedAt,
        database: "reachable",
        productCount: count ?? 0,
        latestLaunchDate: latest?.launch_date ?? null
      },
      {
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
