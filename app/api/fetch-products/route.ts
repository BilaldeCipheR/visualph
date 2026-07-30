import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { env, requireEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildProductRows,
  fetchAllDailyProducts,
  ProductHuntRequestError
} from "@/lib/product-hunt/fetch-products";

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized."
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": "Bearer"
        }
      }
    );
  }

  return handleRequest(request);
}

function isAuthorized(request: NextRequest) {
  requireEnv("syncSecret");

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const providedSecret = authorization.slice("Bearer ".length);
  const expectedSecret = env.syncSecret;
  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

async function handleRequest(request: NextRequest) {
  const date = await resolveRequestedDate(request);

  if (!date) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid date. Use YYYY-MM-DD via ?date= or JSON body { \"date\": \"YYYY-MM-DD\" }."
      },
      { status: 400 }
    );
  }

  try {
    const { products, pageCount } = await fetchAllDailyProducts(date);
    const rows = buildProductRows(products, date);
    const supabase = createSupabaseAdminClient();

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("launch_date", date);

    if (deleteError) {
      throw new Error(`Supabase delete failed: ${deleteError.message}`);
    }

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        date,
        fetchedCount: products.length,
        upsertedCount: 0,
        pageCount
      });
    }

    const { data, error } = await supabase
      .from("products")
      .upsert(rows, {
        onConflict: "product_hunt_id",
        ignoreDuplicates: true
      })
      .select("id");

    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      date,
      fetchedCount: products.length,
      upsertedCount: data?.length ?? rows.length,
      pageCount
    });
  } catch (error) {
    if (error instanceof ProductHuntRequestError) {
      return NextResponse.json(
        {
          ok: false,
          date,
          error: error.message,
          details: error.details
        },
        { status: error.status }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          ok: false,
          date,
          error: error.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        date,
        error: "Unknown error."
      },
      { status: 500 }
    );
  }
}

async function resolveRequestedDate(request: NextRequest) {
  const urlDate = request.nextUrl.searchParams.get("date");
  if (isValidDateString(urlDate)) {
    return urlDate;
  }

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as
        | { date?: unknown }
        | null;

      if (isValidDateString(body?.date)) {
        return body.date;
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return urlDate === null ? today : null;
}

function isValidDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  );
}
