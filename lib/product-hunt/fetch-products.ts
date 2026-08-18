import { env, requireEnv } from "@/lib/env";

const PRODUCT_HUNT_API_URL = "https://api.producthunt.com/v2/api/graphql";
const DEFAULT_PAGE_SIZE = 20;
const REDIRECT_RESOLVE_TIMEOUT_MS = 10_000;

const POSTS_DAILY_QUERY = `
  query PostsDaily($postedAfter: DateTime!, $postedBefore: DateTime!, $first: Int!, $after: String) {
    posts(
      featured: true
      postedAfter: $postedAfter
      postedBefore: $postedBefore
      first: $first
      after: $after
      order: RANKING
    ) {
      edges {
        cursor
        node {
          commentsCount
          dailyRank
          featuredAt
          id
          media {
            type
            url(width: 1440)
          }
          name
          slug
          tagline
          website
          url
          votesCount
          topics(first: 20) {
            edges {
              node {
                name
              }
            }
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

type ProductHuntTopicNode = {
  name: string | null;
};

type ProductHuntTopicEdge = {
  node: ProductHuntTopicNode | null;
};

type ProductHuntPostNode = {
  commentsCount: number | null;
  dailyRank: number | null;
  featuredAt: string | null;
  id: string;
  media?: Array<{
    type: string | null;
    url: string | null;
  }> | null;
  name: string | null;
  slug: string | null;
  tagline: string | null;
  url: string | null;
  votesCount: number | null;
  website: string | null;
  topics?: {
    edges?: ProductHuntTopicEdge[] | null;
  } | null;
};

type ProductHuntPostEdge = {
  cursor: string;
  node: ProductHuntPostNode | null;
};

type ProductHuntPostsDailyResponse = {
  posts?: {
    edges?: ProductHuntPostEdge[] | null;
    pageInfo?: {
      endCursor?: string | null;
      hasNextPage?: boolean | null;
    } | null;
  } | null;
};

type ProductHuntGraphQlResponse = {
  data?: ProductHuntPostsDailyResponse;
  errors?: Array<{
    message: string;
    path?: Array<string | number>;
    extensions?: Record<string, unknown>;
  }>;
};

export type ProductHuntProduct = {
  commentsCount: number;
  dailyRank: number | null;
  featuredAt: string | null;
  id: string;
  media: Array<{ type: string; url: string }>;
  name: string;
  slug: string;
  tagline: string;
  url: string;
  votesCount: number;
  website: string;
  topics: Array<{ name: string }>;
};

export type ProductUpsertRow = {
  product_hunt_id: number;
  slug: string;
  name: string;
  tagline: string;
  website_url: string;
  product_hunt_url: string;
  launch_date: string;
  launched_at: string;
  featured_at: string;
  daily_rank: number;
  votes_count: number;
  comments_count: number;
  topic_slugs: string[];
  topic_names: string[];
  source_payload: Record<string, unknown>;
};

export class ProductHuntRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ProductHuntRequestError";
  }
}

export async function fetchAllDailyProducts(
  date: string,
  fetchImpl: typeof fetch = fetch
) {
  requireEnv("productHuntApiToken");

  const postedAfter = new Date(`${date}T00:00:00.000Z`).toISOString();
  const postedBefore = new Date(`${date}T23:59:59.999Z`).toISOString();
  const products: ProductHuntProduct[] = [];
  let after: string | null = null;
  let hasNextPage = true;
  let page = 0;

  while (hasNextPage) {
    page += 1;

    const response = await fetchImpl(PRODUCT_HUNT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.productHuntApiToken}`
      },
      body: JSON.stringify({
        query: POSTS_DAILY_QUERY,
        variables: {
          postedAfter,
          postedBefore,
          first: DEFAULT_PAGE_SIZE,
          after
        }
      }),
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => null)) as
      | ProductHuntGraphQlResponse
      | null;

    if (!response.ok) {
      throw new ProductHuntRequestError(
        "Product Hunt API request failed.",
        response.status,
        payload
      );
    }

    if (payload?.errors?.length) {
      throw new ProductHuntRequestError(
        "Product Hunt GraphQL query returned errors.",
        502,
        payload.errors
      );
    }

    const edges = payload?.data?.posts?.edges ?? [];
    const pageInfo = payload?.data?.posts?.pageInfo;

    for (const edge of edges) {
      if (!edge?.node?.id || !edge.node.url) {
        continue;
      }

      const website = await resolveExternalWebsiteUrl(
        edge.node.website?.trim() || edge.node.url,
        fetchImpl
      );

      products.push({
        commentsCount: edge.node.commentsCount ?? 0,
        dailyRank: edge.node.dailyRank ?? null,
        featuredAt: edge.node.featuredAt ?? null,
        id: edge.node.id,
        media:
          edge.node.media
            ?.filter(
              (media): media is { type: string; url: string } =>
                Boolean(media?.type?.trim() && media?.url?.trim())
            )
            .map((media) => ({
              type: media.type.trim(),
              url: media.url.trim()
            })) ?? [],
        name: edge.node.name?.trim() || "Untitled product",
        slug: edge.node.slug?.trim() || deriveSlug(edge.node.url, edge.node.name ?? "", edge.node.id),
        tagline: edge.node.tagline?.trim() || "",
        url: edge.node.url,
        votesCount: edge.node.votesCount ?? 0,
        website,
        topics:
          edge.node.topics?.edges
            ?.map((topicEdge) => topicEdge?.node?.name?.trim())
            .filter((topicName): topicName is string => Boolean(topicName))
            .map((name) => ({ name })) ?? []
      });
    }

    hasNextPage = Boolean(pageInfo?.hasNextPage);
    after = pageInfo?.endCursor ?? null;

    if (hasNextPage && !after) {
      throw new ProductHuntRequestError(
        "Product Hunt pagination was incomplete.",
        502,
        { page, pageInfo }
      );
    }
  }

  return {
    products,
    pageCount: page
  };
}

export function buildProductRows(products: ProductHuntProduct[], date: string) {
  const launchTimestamp = new Date(`${date}T00:05:00.000Z`).toISOString();

  return products.map((product, index): ProductUpsertRow => ({
    product_hunt_id: Number.parseInt(product.id, 10),
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    website_url: product.website,
    product_hunt_url: product.url,
    launch_date: date,
    launched_at: product.featuredAt ?? launchTimestamp,
    featured_at: product.featuredAt ?? launchTimestamp,
    daily_rank: index + 1,
    votes_count: product.votesCount,
    comments_count: product.commentsCount,
    topic_slugs: product.topics.map((topic) => slugify(topic.name)),
    topic_names: product.topics.map((topic) => topic.name),
    source_payload: {
      id: product.id,
      media: product.media,
      name: product.name,
      slug: product.slug,
      tagline: product.tagline,
      url: product.url,
      votesCount: product.votesCount,
      website: product.website,
      topics: product.topics
    }
  }));
}

function deriveSlug(url: string, name: string, productId: string) {
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.trim();

    if (slug) {
      return slugify(slug);
    }
  } catch {
    // Fall back to a deterministic slug below.
  }

  const normalizedName = slugify(name);
  return normalizedName || `product-${productId}`;
}

async function resolveExternalWebsiteUrl(rawUrl: string, fetchImpl: typeof fetch) {
  if (!isProductHuntUrl(rawUrl)) {
    return rawUrl;
  }

  const resolved = await resolveRedirectUrl(rawUrl, fetchImpl, "HEAD");
  if (resolved && !isProductHuntUrl(resolved)) {
    return resolved;
  }

  const getResolved = await resolveRedirectUrl(rawUrl, fetchImpl, "GET");
  if (getResolved && !isProductHuntUrl(getResolved)) {
    return getResolved;
  }

  return rawUrl;
}

async function resolveRedirectUrl(
  rawUrl: string,
  fetchImpl: typeof fetch,
  method: "GET" | "HEAD"
) {
  try {
    const response = await fetchImpl(rawUrl, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(REDIRECT_RESOLVE_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; VisualPH/1.0; +https://github.com/visualph)"
      }
    });

    return response.url || null;
  } catch {
    return null;
  }
}

function isProductHuntUrl(rawUrl: string) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname === "producthunt.com" || hostname.endsWith(".producthunt.com");
  } catch {
    return false;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
