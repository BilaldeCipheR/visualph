import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireEnv } from "../lib/env";

const BUCKET = process.env.SCREENSHOT_BUCKET ?? "screenshots";
const PAGE_SIZE = 1_000;
const DELETE_BATCH_SIZE = Number(process.env.ORPHAN_DELETE_BATCH_SIZE ?? "250");
const REVIEWED_ORPHAN_HASH =
  "9348f10cf5a8c051ebf267e050e4bc4f1641da7ab16a7dfc36f765b4a720639c";

type ProductScreenshotRow = {
  launch_date: string;
  screenshot_path: string | null;
  slug: string;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const expectedCount = optionalIntegerEnv("EXPECTED_ORPHAN_COUNT");
  const expectedHash = process.env.EXPECTED_ORPHAN_HASH?.trim().toLowerCase();
  const supabase = createClient(
    requireEnv("nextPublicSupabaseUrl"),
    requireEnv("supabaseServiceRoleKey"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  if (!Number.isInteger(DELETE_BATCH_SIZE) || DELETE_BATCH_SIZE < 1 || DELETE_BATCH_SIZE > 1_000) {
    throw new Error("ORPHAN_DELETE_BATCH_SIZE must be an integer between 1 and 1000");
  }

  const products = await loadProducts(supabase);
  const referencedPaths = new Set(
    products.flatMap((product) => product.screenshot_path ? [product.screenshot_path] : [])
  );
  const legacyCandidates = Array.from(new Set(products.flatMap((product) => [
    `products/${product.slug}/latest.png`,
    `products/${product.launch_date}/${product.slug}/latest.png`,
    `products/${product.launch_date}/${product.slug}/latest.jpg`
  ]))).sort();
  const currentPathMatches = legacyCandidates.filter((path) => referencedPaths.has(path));

  console.log(JSON.stringify({
    apply,
    bucket: BUCKET,
    productCount: products.length,
    referencedCount: referencedPaths.size,
    legacyCandidateCount: legacyCandidates.length,
    currentPathMatchCount: currentPathMatches.length,
    reviewedOrphanHash: REVIEWED_ORPHAN_HASH,
    deleteBatchSize: DELETE_BATCH_SIZE
  }, null, 2));

  if (currentPathMatches.length !== 0) {
    throw new Error(`Safety check failed: ${currentPathMatches.length} legacy candidates are currently referenced`);
  }

  if (!apply) return;

  if (expectedCount === undefined || !expectedHash) {
    throw new Error("Apply mode requires EXPECTED_ORPHAN_COUNT and EXPECTED_ORPHAN_HASH");
  }
  if (expectedHash !== REVIEWED_ORPHAN_HASH) {
    throw new Error(`Reviewed manifest hash mismatch: expected ${REVIEWED_ORPHAN_HASH}, received ${expectedHash}`);
  }

  let deletedCount = 0;
  for (let start = 0; start < legacyCandidates.length; start += DELETE_BATCH_SIZE) {
    const batch = legacyCandidates.slice(start, start + DELETE_BATCH_SIZE);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Failed to delete candidate batch starting at ${start}: ${error.message}`);
    deletedCount += data?.length ?? 0;
    console.log(
      `Processed batch ${Math.floor(start / DELETE_BATCH_SIZE) + 1}: ${batch.length} candidates, ${data?.length ?? 0} deleted; total ${deletedCount}`
    );
  }

  if (deletedCount !== expectedCount) {
    throw new Error(`Deletion count mismatch: expected ${expectedCount}, deleted ${deletedCount}`);
  }

  console.log(JSON.stringify({
    deletedCount,
    reviewedOrphanHash: REVIEWED_ORPHAN_HASH
  }));
}

async function loadProducts(supabase: SupabaseClient): Promise<ProductScreenshotRow[]> {
  const products: ProductScreenshotRow[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("products")
      .select("launch_date,screenshot_path,slug")
      .order("id", { ascending: true })
      .range(start, start + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load products: ${error.message}`);
    products.push(...((data ?? []) as ProductScreenshotRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return products;
}

function optionalIntegerEnv(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
