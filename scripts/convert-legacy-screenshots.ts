import { createClient } from "@supabase/supabase-js";

import { requireEnv } from "../lib/env";
import { optimizeScreenshot, SCREENSHOT_CONTENT_TYPE } from "../lib/screenshot-image";
import { buildScreenshotStoragePath } from "../lib/screenshot-path";

type ProductRow = {
  id: string | number;
  launch_date: string;
  screenshot_attempt_count: number | null;
  screenshot_bucket: string | null;
  screenshot_path: string | null;
  screenshot_source: string | null;
  slug: string | null;
};

const DEFAULT_BUCKET = "screenshots";
const DEFAULT_PATH_PREFIX = "products";

async function main() {
  const { from, to } = parseArgs(process.argv.slice(2));
  const supabase = createClient(
    requireEnv("nextPublicSupabaseUrl"),
    requireEnv("supabaseServiceRoleKey"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("products")
    .select(
      "id,launch_date,slug,screenshot_attempt_count,screenshot_bucket,screenshot_path,screenshot_source"
    )
    .gte("launch_date", from)
    .lte("launch_date", to)
    .order("launch_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load July products: ${error.message}`);
  }

  const products = ((data ?? []) as ProductRow[]).filter(
    (product) =>
      Boolean(product.screenshot_path) &&
      !product.screenshot_path!.toLowerCase().endsWith(".webp")
  );

  let converted = 0;
  const failures: Array<{ id: string | number; path: string; error: string }> = [];

  for (const product of products) {
    const sourceBucket = product.screenshot_bucket || DEFAULT_BUCKET;
    const sourcePath = product.screenshot_path!;

    try {
      const { data: source, error: downloadError } = await supabase.storage
        .from(sourceBucket)
        .download(sourcePath);

      if (downloadError || !source) {
        throw new Error(downloadError?.message || "Storage download returned no data.");
      }

      const optimized = await optimizeScreenshot(
        Buffer.from(await source.arrayBuffer())
      );
      const destinationPath = buildScreenshotStoragePath({
        launchDate: product.launch_date,
        pathPrefix: DEFAULT_PATH_PREFIX,
        productId: String(product.id),
        slug: product.slug || String(product.id)
      });

      const { error: uploadError } = await supabase.storage
        .from(DEFAULT_BUCKET)
        .upload(destinationPath, optimized.buffer, {
          contentType: SCREENSHOT_CONTENT_TYPE,
          upsert: true
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrl } = supabase.storage
        .from(DEFAULT_BUCKET)
        .getPublicUrl(destinationPath);
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("products")
        .update({
          screenshot_status: "captured",
          screenshot_source:
            product.screenshot_source === "product-media" ? "product-media" : "website",
          screenshot_error: null,
          screenshot_attempt_count: (product.screenshot_attempt_count ?? 0) + 1,
          screenshot_last_attempted_at: now,
          screenshot_bucket: DEFAULT_BUCKET,
          screenshot_path: destinationPath,
          screenshot_url: publicUrl.publicUrl,
          screenshot_width: optimized.width,
          screenshot_height: optimized.height,
          screenshot_bytes: optimized.bytes,
          screenshot_mime_type: SCREENSHOT_CONTENT_TYPE,
          screenshot_captured_at: now
        })
        .eq("id", product.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      converted += 1;
      console.log(`[convert] ${product.launch_date} ${product.slug ?? product.id} -> ${destinationPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ id: product.id, path: sourcePath, error: message });
      console.error(`[convert] failed ${sourcePath}: ${message}`);
    }
  }

  console.log(
    JSON.stringify(
      { ok: failures.length === 0, from, to, candidates: products.length, converted, failures },
      null,
      2
    )
  );

  if (failures.length > 0) {
    throw new Error(`${failures.length} legacy screenshot conversions failed.`);
  }
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || !value || !["--from", "--to"].includes(flag)) {
      throw new Error("Usage: tsx scripts/convert-legacy-screenshots.ts --from YYYY-MM-DD --to YYYY-MM-DD");
    }
    values.set(flag, value);
  }

  const from = values.get("--from");
  const to = values.get("--to");
  const valid = (value: string | undefined) =>
    Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

  if (!valid(from) || !valid(to) || from! > to!) {
    throw new Error("A valid --from and --to date range is required.");
  }

  return { from: from!, to: to! };
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
