import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireEnv } from "../lib/env";

const BUCKET = process.env.SCREENSHOT_BUCKET ?? "screenshots";
const REVIEWED_PATHS_FILE =
  process.env.ORPHAN_PATHS_FILE ?? "ops/orphan-paths-20260825.txt";
const PAGE_SIZE = 1_000;
const DELETE_BATCH_SIZE = Number(process.env.ORPHAN_DELETE_BATCH_SIZE ?? "250");

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

  const reviewedPaths = (await readFile(REVIEWED_PATHS_FILE, "utf8"))
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean)
    .sort();

  if (new Set(reviewedPaths).size !== reviewedPaths.length) {
    throw new Error("Reviewed orphan manifest contains duplicate paths");
  }

  const reviewedHash = hashPaths(reviewedPaths);
  const referencedPaths = await loadReferencedPaths(supabase);
  const currentPathMatches = reviewedPaths.filter((path) => referencedPaths.has(path));

  console.log(JSON.stringify({
    apply,
    bucket: BUCKET,
    reviewedPathCount: reviewedPaths.length,
    reviewedHash,
    referencedCount: referencedPaths.size,
    currentPathMatchCount: currentPathMatches.length,
    deleteBatchSize: DELETE_BATCH_SIZE
  }, null, 2));

  if (currentPathMatches.length !== 0) {
    throw new Error(`Safety check failed: ${currentPathMatches.length} reviewed paths are now referenced`);
  }

  if (!apply) return;

  if (expectedCount === undefined || !expectedHash) {
    throw new Error("Apply mode requires EXPECTED_ORPHAN_COUNT and EXPECTED_ORPHAN_HASH");
  }
  if (reviewedPaths.length !== expectedCount) {
    throw new Error(`Manifest count changed: expected ${expectedCount}, found ${reviewedPaths.length}`);
  }
  if (reviewedHash !== expectedHash) {
    throw new Error(`Manifest hash changed: expected ${expectedHash}, found ${reviewedHash}`);
  }

  let deletedCount = 0;
  for (let start = 0; start < reviewedPaths.length; start += DELETE_BATCH_SIZE) {
    const batch = reviewedPaths.slice(start, start + DELETE_BATCH_SIZE);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Failed to delete batch starting at ${start}: ${error.message}`);
    if ((data ?? []).length !== batch.length) {
      throw new Error(`Deletion count mismatch at offset ${start}: expected ${batch.length}, got ${data?.length ?? 0}`);
    }
    deletedCount += batch.length;
    console.log(`Deleted batch ${Math.floor(start / DELETE_BATCH_SIZE) + 1}: ${batch.length} objects; total ${deletedCount}`);
  }

  console.log(JSON.stringify({
    deletedCount,
    deletedHash: reviewedHash
  }));
}

async function loadReferencedPaths(supabase: SupabaseClient): Promise<Set<string>> {
  const referencedPaths = new Set<string>();
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("products")
      .select("screenshot_path")
      .not("screenshot_path", "is", null)
      .range(start, start + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load screenshot references: ${error.message}`);
    for (const row of data ?? []) {
      if (row.screenshot_path) referencedPaths.add(row.screenshot_path);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return referencedPaths;
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

function hashPaths(paths: string[]): string {
  return createHash("sha256").update(paths.join("\n")).digest("hex");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
