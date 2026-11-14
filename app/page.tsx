import { VisualPHExplorer, type Launch } from "@/components/visualph/visualph-explorer";
import { getLatestLaunchDate, getProducts, getSearchIndex } from "@/lib/products";

type PageProps = {
  searchParams?: Promise<{
    category?: string;
    date?: string;
  }>;
};

function toLaunch(product: Awaited<ReturnType<typeof getProducts>>[number]) {
  return {
    id: product.id,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    votes: product.votesCount,
    rank: product.dailyRank,
    category: product.topicNames[0] ?? "Uncategorized",
    topic: product.topicNames[1] ?? product.topicNames[0] ?? "General",
    launchedAt: product.launchDate,
    productHuntUrl: product.productHuntUrl,
    websiteUrl: product.websiteUrl,
    screenshotUrl: product.screenshotUrl,
    screenshotWidth: product.screenshotWidth,
    screenshotHeight: product.screenshotHeight
  };
}

function isValidDate(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedDate = isValidDate(params?.date)
    ? params.date
    : await getLatestLaunchDate();
  const selectedCategory =
    typeof params?.category === "string" && params.category.trim()
      ? params.category
      : "all";
  const [products, searchIndex] = await Promise.all([
    getProducts({ date: selectedDate }),
    getSearchIndex()
  ]);

  const categories = Array.from(
    new Set(products.flatMap((product) => product.topicNames).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));

  const launches: Launch[] = products.map(toLaunch);
  const explorerProps = {
    availableCategories: categories,
    launches,
    searchIndex: searchIndex.map(toLaunch),
    selectedCategory,
    selectedDate
  };

  return <VisualPHExplorer {...explorerProps} />;
}
