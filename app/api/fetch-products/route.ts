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
  const requestParams = await resolveRequestedParams(request);
  const { allowEmpty, date } = requestParams;

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

    const { data, error } = await supabase.rpc("replace_daily_products", {
      p_allow_empty: allowEmpty,
      p_launch_date: date,
      p_products: rows
    });

    if (error) {
      throw new Error(`Supabase replace failed: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      date,
      fetchedCount: products.length,
      upsertedCount: typeof data === "number" ? data : rows.length,
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

async function resolveRequestedParams(request: NextRequest) {
  const urlDate = request.nextUrl.searchParams.get("date");
  const urlAllowEmpty = parseBooleanFlag(request.nextUrl.searchParams.get("allowEmpty"));

  let bodyDate: string | null = null;
  let bodyAllowEmpty = false;

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as
        | { allowEmpty?: unknown; date?: unknown }
        | null;

      if (isValidDateString(body?.date)) {
        bodyDate = body.date;
      }

      bodyAllowEmpty = parseBooleanFlag(body?.allowEmpty) ?? false;
    }
  }

  const resolvedDate = isValidDateString(urlDate)
    ? urlDate
    : isValidDateString(bodyDate)
      ? bodyDate
      : urlDate === null && bodyDate === null
        ? new Date().toISOString().slice(0, 10)
        : null;

  return {
    allowEmpty: urlAllowEmpty ?? bodyAllowEmpty,
    date: resolvedDate
  };
}

function parseBooleanFlag(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === 0) {
    return Boolean(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return null;
}

function isValidDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  );
}
