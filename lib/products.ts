import { createSupabasePublicClient } from "@/lib/supabase/public";
import type { ProductFilterState, ProductRecord } from "@/lib/types";
import { unstable_cache } from "next/cache";

const PRODUCT_LIST_COLUMNS =
  "id,name,tagline,description,website_url,product_hunt_url,votes_count,daily_rank,launch_date,screenshot_url,screenshot_width,screenshot_height,topic_names" as const;

export const PRODUCTS_CACHE_TAG = "visualph-products";
export const SEARCH_INDEX_CACHE_TAG = "visualph-search-index";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeProducts(rows: Record<string, unknown>[] | null): ProductRecord[] {
  if (!rows) {
    return [];
  }

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? "Untitled product"),
    tagline: String(row.tagline ?? ""),
    description: row.description ? String(row.description) : undefined,
    websiteUrl: String(row.website_url ?? ""),
    productHuntUrl: String(row.product_hunt_url ?? ""),
    votesCount: Number(row.votes_count ?? 0),
    dailyRank: Number(row.daily_rank ?? 0),
    launchDate: String(row.launch_date ?? todayUtc()),
    screenshotUrl: row.screenshot_url ? String(row.screenshot_url) : null,
    screenshotWidth:
      typeof row.screenshot_width === "number" ? row.screenshot_width : null,
    screenshotHeight:
      typeof row.screenshot_height === "number" ? row.screenshot_height : null,
    topicNames: Array.isArray(row.topic_names)
      ? row.topic_names.map((topic) => String(topic))
      : []
  }));
}

export async function getLatestLaunchDate(): Promise<string> {
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("products")
      .select("launch_date")
      .order("launch_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.launch_date) {
      return todayUtc();
    }

    return String(data.launch_date);
  } catch {
    return todayUtc();
  }
}

async function queryProductsByDate(date: string): Promise<ProductRecord[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_LIST_COLUMNS)
    .eq("launch_date", date)
    .order("votes_count", { ascending: false })
    .order("daily_rank", { ascending: true });

  if (error) {
    throw error;
  }

  return normalizeProducts(data as Record<string, unknown>[] | null);
}

const getCachedProductsByDate = unstable_cache(
  queryProductsByDate,
  ["visualph-products-by-date-v2"],
  { revalidate: 60, tags: [PRODUCTS_CACHE_TAG] }
);

async function querySearchIndex(limit: number): Promise<ProductRecord[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_LIST_COLUMNS)
    .order("launch_date", { ascending: false })
    .order("votes_count", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return normalizeProducts(data as Record<string, unknown>[] | null);
}

const getCachedSearchIndex = unstable_cache(querySearchIndex, ["visualph-search-index-v1"], {
  revalidate: 60,
  tags: [SEARCH_INDEX_CACHE_TAG]
});

export async function getSearchIndex(limit = 2_000): Promise<ProductRecord[]> {
  try {
    return await getCachedSearchIndex(limit);
  } catch {
    return [];
  }
}

export async function getProducts({ date }: ProductFilterState): Promise<ProductRecord[]> {
  try {
    return await getCachedProductsByDate(date);
  } catch {
    return [];
  }
}


