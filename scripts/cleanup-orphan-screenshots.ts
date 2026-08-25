import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireEnv } from "../lib/env";

const BUCKET = process.env.SCREENSHOT_BUCKET ?? "screenshots";
const ROOT = process.env.SCREENSHOT_PATH_PREFIX ?? "products";
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

  const referencedPaths = await loadReferencedPaths(supabase);
  const storedPaths = await listStoredPaths(supabase, ROOT);
  const orphans = storedPaths.filter((path) => !referencedPaths.has(path)).sort();
  const orphanHash = hashPaths(orphans);

  console.log(JSON.stringify({
    apply,
    bucket: BUCKET,
    root: ROOT,
    referencedCount: referencedPaths.size,
    storedCount: storedPaths.length,
    orphanCount: orphans.length,
    orphanHash,
    deleteBatchSize: DELETE_BATCH_SIZE,
    orphans
  }, null, 2));

  if (!apply || orphans.length === 0) return;

  if (expectedCount === undefined || !expectedHash) {
    throw new Error("Apply mode requires EXPECTED_ORPHAN_COUNT and EXPECTED_ORPHAN_HASH");
  }
  if (orphans.length !== expectedCount) {
    throw new Error(`Orphan count changed: expected ${expectedCount}, found ${orphans.length}`);
  }
  if (orphanHash !== expectedHash) {
    throw new Error(`Orphan hash changed: expected ${expectedHash}, found ${orphanHash}`);
  }

  for (let start = 0; start < orphans.length; start += DELETE_BATCH_SIZE) {
    const batch = orphans.slice(start, start + DELETE_BATCH_SIZE);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Failed to delete orphan batch starting at ${start}: ${error.message}`);
    if ((data ?? []).length !== batch.length) {
      throw new Error(`Deletion count mismatch at offset ${start}: expected ${batch.length}, got ${data?.length ?? 0}`);
    }
    console.log(`Deleted batch ${Math.floor(start / DELETE_BATCH_SIZE) + 1}: ${batch.length} objects`);
  }

  const remainingStoredPaths = await listStoredPaths(supabase, ROOT);
  const remainingOrphans = remainingStoredPaths
    .filter((path) => !referencedPaths.has(path))
    .sort();

  if (remainingOrphans.length !== 0) {
    throw new Error(`Verification failed: ${remainingOrphans.length} orphan objects remain`);
  }

  console.log(JSON.stringify({
    deletedCount: orphans.length,
    deletedHash: orphanHash,
    remainingOrphanCount: 0
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

async function listAll(
  supabase: SupabaseClient,
  path: string
) {
  const results: Array<{ id: string | null; name: string }> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(BUCKET).list(path, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw new Error(`Failed to list ${path}: ${error.message}`);
    results.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return results;
}

async function listStoredPaths(supabase: SupabaseClient, path: string): Promise<string[]> {
  const paths: string[] = [];

  for (const item of await listAll(supabase, path)) {
    const itemPath = `${path}/${item.name}`;

    if (item.id === null) {
      paths.push(...(await listStoredPaths(supabase, itemPath)));
    } else {
      paths.push(itemPath);
    }
  }

  return paths;
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
