import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProductFilterState, ProductRecord } from "@/lib/types";
import { unstable_cache } from "next/cache";

const PRODUCT_LIST_COLUMNS =
  "id,name,tagline,website_url,product_hunt_url,votes_count,daily_rank,launch_date,screenshot_url,screenshot_width,screenshot_height,topic_names" as const;

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
    const supabase = createSupabaseAdminClient();
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
  const supabase = createSupabaseAdminClient();
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
  { revalidate: 60 }
);

export async function getProducts({ date }: ProductFilterState): Promise<ProductRecord[]> {
  try {
    return await getCachedProductsByDate(date);
  } catch {
    return [];
  }
}

export async function getAvailableLaunchDates(): Promise<string[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const dates = new Set<string>();
    const pageSize = 1_000;

    for (let start = 0; ; start += pageSize) {
      const { data, error } = await supabase
        .from("products")
        .select("launch_date")
        .order("launch_date", { ascending: false })
        .range(start, start + pageSize - 1);

      if (error) {
        throw error;
      }

      for (const row of data ?? []) {
        if (row.launch_date) {
          dates.add(String(row.launch_date));
        }
      }

      if (!data || data.length < pageSize) {
        break;
      }
    }

    return [...dates].sort((left, right) => right.localeCompare(left));
  } catch {
    return [];
  }
}

export async function getAvailableCategories(date: string): Promise<string[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select("topic_names")
      .eq("launch_date", date);

    if (error || !data) {
      return [];
    }

    const names = new Set<string>();

    for (const row of data) {
      const topics = Array.isArray(row.topic_names) ? (row.topic_names as unknown[]) : [];

      for (const topic of topics) {
        if (typeof topic === "string" && topic.trim()) {
          names.add(topic);
        }
      }
    }

    return [...names].sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}
