import { createClient } from "@supabase/supabase-js";

import { requireEnv } from "../lib/env";
import {
  buildProductRows,
  fetchAllDailyProducts
} from "../lib/product-hunt/fetch-products";

type ExistingProduct = {
  id: string | number;
  product_hunt_id: number;
};

async function main() {
  const { from, to, maxScreenshotBytes } = parseArgs(process.argv.slice(2));
  const supabase = createClient(
    requireEnv("nextPublicSupabaseUrl"),
    requireEnv("supabaseServiceRoleKey"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let rehydrated = 0;
  const unmatched: Array<{ date: string; productHuntId: number }> = [];

  for (const date of enumerateDates(from, to)) {
    const { products } = await fetchAllDailyProducts(date);
    const incoming = new Map(
      buildProductRows(products, date).map((row) => [row.product_hunt_id, row])
    );

    let query = supabase
      .from("products")
      .select("id,product_hunt_id")
      .eq("launch_date", date);

    query = maxScreenshotBytes === null
      ? query.is("screenshot_path", null)
      : query.or(`screenshot_path.is.null,screenshot_bytes.lt.${maxScreenshotBytes}`);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load source-repair products for ${date}: ${error.message}`);
    }

    for (const product of (data ?? []) as ExistingProduct[]) {
      const row = incoming.get(product.product_hunt_id);
      if (!row) {
        unmatched.push({ date, productHuntId: product.product_hunt_id });
        continue;
      }

      const { error: updateError } = await supabase
        .from("products")
        .update({
          website_url: row.website_url,
          product_hunt_url: row.product_hunt_url,
          thumbnail_url: row.thumbnail_url,
          source_payload: row.source_payload
        })
        .eq("id", product.id);

      if (updateError) {
        throw new Error(
          `Failed to rehydrate product ${product.product_hunt_id} on ${date}: ${updateError.message}`
        );
      }

      rehydrated += 1;
    }

    console.log(`[rehydrate] ${date}: ${data?.length ?? 0} source-repair rows checked`);
  }

  console.log(JSON.stringify({
    ok: unmatched.length === 0,
    from,
    to,
    maxScreenshotBytes,
    rehydrated,
    unmatched
  }, null, 2));

  if (unmatched.length > 0) {
    throw new Error(`${unmatched.length} source-repair products were not returned by Product Hunt.`);
  }
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || !value || !["--from", "--to", "--max-screenshot-bytes"].includes(flag)) {
      throw new Error(
        "Usage: tsx scripts/rehydrate-product-sources.ts --from YYYY-MM-DD --to YYYY-MM-DD [--max-screenshot-bytes N]"
      );
    }
    values.set(flag, value);
  }

  const from = values.get("--from");
  const to = values.get("--to");
  const maxScreenshotBytesValue = values.get("--max-screenshot-bytes");
  const validDate = (value: string | undefined) =>
    Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

  if (!validDate(from) || !validDate(to) || from! > to!) {
    throw new Error("A valid --from and --to date range is required.");
  }

  const maxScreenshotBytes = maxScreenshotBytesValue === undefined
    ? null
    : Number.parseInt(maxScreenshotBytesValue, 10);

  if (maxScreenshotBytes !== null && (!Number.isSafeInteger(maxScreenshotBytes) || maxScreenshotBytes <= 0)) {
    throw new Error("--max-screenshot-bytes must be a positive integer.");
  }

  return { from: from!, to: to!, maxScreenshotBytes };
}

function enumerateDates(from: string, to: string) {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const last = new Date(`${to}T00:00:00.000Z`);

  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
