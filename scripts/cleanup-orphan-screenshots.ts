import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireEnv } from "../lib/env";

const BUCKET = process.env.SCREENSHOT_BUCKET ?? "screenshots";
const ROOT = process.env.SCREENSHOT_PATH_PREFIX ?? "products";
const PAGE_SIZE = 1_000;

async function main() {
  const apply = process.argv.includes("--apply");
  const supabase = createClient(
    requireEnv("nextPublicSupabaseUrl"),
    requireEnv("supabaseServiceRoleKey"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

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

  const folders = await listAll(supabase, ROOT);
  const storedPaths: string[] = [];
  for (const folder of folders.filter((item) => !item.name.includes("."))) {
    const files = await listAll(supabase, `${ROOT}/${folder.name}`);
    for (const file of files) storedPaths.push(`${ROOT}/${folder.name}/${file.name}`);
  }

  const orphans = storedPaths.filter((path) => !referencedPaths.has(path)).sort();
  console.log(JSON.stringify({ apply, bucket: BUCKET, orphanCount: orphans.length, orphans }, null, 2));

  if (!apply || orphans.length === 0) return;
  for (let start = 0; start < orphans.length; start += PAGE_SIZE) {
    const batch = orphans.slice(start, start + PAGE_SIZE);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Failed to delete orphan batch: ${error.message}`);
  }
}

async function listAll(
  supabase: SupabaseClient,
  path: string
) {
  const results: Array<{ name: string }> = [];
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

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
