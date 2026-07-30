import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProductFilterState, ProductRecord } from "@/lib/types";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeProducts(rows: Record<string, unknown>[] | null): ProductRecord[] {
  if (!rows) {
    return [];
  }

  return rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug ?? ""),
    productHuntId: String(row.product_hunt_id ?? ""),
    name: String(row.name ?? "Untitled product"),
    tagline: String(row.tagline ?? ""),
    websiteUrl: String(row.website_url ?? ""),
    productHuntUrl: String(row.product_hunt_url ?? ""),
    votesCount: Number(row.votes_count ?? 0),
    dailyRank: Number(row.daily_rank ?? 0),
    launchDate: String(row.launch_date ?? todayUtc()),
    screenshotPath: row.screenshot_path ? String(row.screenshot_path) : null,
    screenshotUrl: row.screenshot_url ? String(row.screenshot_url) : null,
    screenshotCapturedAt: row.screenshot_captured_at
      ? String(row.screenshot_captured_at)
      : null,
    topicSlugs: Array.isArray(row.topic_slugs)
      ? row.topic_slugs.map((topic) => String(topic))
      : [],
    topicNames: Array.isArray(row.topic_names)
      ? row.topic_names.map((topic) => String(topic))
      : [],
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
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

export async function getProducts({ date }: ProductFilterState): Promise<ProductRecord[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("launch_date", date)
      .order("votes_count", { ascending: false })
      .order("daily_rank", { ascending: true });

    if (error) {
      throw error;
    }

    return normalizeProducts(data as Record<string, unknown>[] | null);
  } catch {
    return [];
  }
}

export async function getAvailableLaunchDates(): Promise<string[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const dates = new Set<string>();
    const pageSize = 1000;

    for (let start = 0; start < 20_000; start += pageSize) {
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
