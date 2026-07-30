import { VisualPHExplorer, type Launch } from "@/components/visualph/visualph-explorer";
import { getLatestLaunchDate, getProducts } from "@/lib/products";

type PageProps = {
  searchParams?: Promise<{
    category?: string;
    date?: string;
    sort?: string;
  }>;
};

function isValidDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const latestDate = await getLatestLaunchDate();
  const selectedDate = isValidDate(params?.date) ? (params?.date as string) : latestDate;
  const selectedSort = params?.sort === "upvotes" ? "upvotes" : "rank";
  const selectedCategory =
    typeof params?.category === "string" && params.category.trim()
      ? params.category
      : "all";

  const products = await getProducts({
    date: selectedDate,
    sort: selectedSort
  });

  const categories = Array.from(
    new Set(products.flatMap((product) => product.topicNames).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));

  const launches: Launch[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    tagline: product.tagline,
    votes: product.votesCount,
    rank: product.dailyRank,
    category: product.topicNames[0] ?? "Uncategorized",
    topic: product.topicNames[1] ?? product.topicNames[0] ?? "General",
    launchedAt: product.launchDate,
    productHuntUrl: product.productHuntUrl,
    websiteUrl: product.websiteUrl,
    screenshotUrl: product.screenshotUrl
  }));

  return (
    <VisualPHExplorer
      key={`${selectedDate}:${selectedCategory}:${selectedSort}`}
      availableCategories={categories}
      launches={launches}
      selectedCategory={selectedCategory}
      selectedDate={selectedDate}
      selectedSort={selectedSort}
    />
  );
}

