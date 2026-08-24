import { createClient } from "@supabase/supabase-js";

import { buildProductRows, fetchAllDailyProducts } from "../lib/product-hunt/fetch-products";

const targets = [
  { id: 2756, productHuntId: 1140101, date: "2026-05-06" },
  { id: 2737, productHuntId: 1140807, date: "2026-05-07" },
  { id: 2685, productHuntId: 1139758, date: "2026-05-07" },
  { id: 2700, productHuntId: 1140614, date: "2026-05-07" },
  { id: 2674, productHuntId: 1136393, date: "2026-05-08" },
  { id: 2668, productHuntId: 1141001, date: "2026-05-08" },
  { id: 2641, productHuntId: 1141763, date: "2026-05-08" },
  { id: 2653, productHuntId: 1141418, date: "2026-05-08" },
  { id: 2614, productHuntId: 1140273, date: "2026-05-10" },
  { id: 2578, productHuntId: 1137017, date: "2026-05-11" },
  { id: 2596, productHuntId: 1141834, date: "2026-05-11" },
  { id: 2514, productHuntId: 1144799, date: "2026-05-12" },
  { id: 2478, productHuntId: 1142374, date: "2026-05-13" },
  { id: 2392, productHuntId: 1139893, date: "2026-05-14" },
  { id: 2326, productHuntId: 1149543, date: "2026-05-18" },
  { id: 2162, productHuntId: 1154818, date: "2026-05-26" },
  { id: 2139, productHuntId: 1155920, date: "2026-05-27" },
  { id: 2122, productHuntId: 1146179, date: "2026-05-27" },
  { id: 2110, productHuntId: 1157293, date: "2026-05-28" },
  { id: 2082, productHuntId: 1154253, date: "2026-05-29" }
] as const;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase service credentials.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

for (const date of [...new Set(targets.map((target) => target.date))]) {
  const { products } = await fetchAllDailyProducts(date);
  const rowsByProductHuntId = new Map(
    buildProductRows(products, date).map((row) => [row.product_hunt_id, row])
  );

  for (const target of targets.filter((candidate) => candidate.date === date)) {
    const refreshed = rowsByProductHuntId.get(target.productHuntId);
    if (!refreshed) {
      throw new Error(`Product Hunt id ${target.productHuntId} was not returned for ${date}.`);
    }

    const { error } = await supabase
      .from("products")
      .update({
        product_hunt_url: refreshed.product_hunt_url,
        source_payload: refreshed.source_payload,
        website_url: refreshed.website_url
      })
      .eq("id", target.id)
      .eq("product_hunt_id", target.productHuntId)
      .eq("launch_date", date);

    if (error) {
      throw new Error(`Failed to refresh product ${target.id}: ${error.message}`);
    }

    console.log(`Refreshed product ${target.id} for ${date}`);
  }
}
