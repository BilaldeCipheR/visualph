export type SearchableLaunch = {
  name: string;
  tagline: string;
  category: string;
  topic: string;
  description?: string;
};

export function queryWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function containsAll(words: string[], values: Array<string | undefined>): boolean {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function matchTier(launch: SearchableLaunch, query: string): 0 | 1 | 2 | 3 {
  const words = queryWords(query);

  if (containsAll(words, [launch.name])) {
    return 3;
  }

  const primaryFields = [launch.name, launch.tagline, launch.category, launch.topic];

  if (containsAll(words, primaryFields)) {
    return 2;
  }

  if (containsAll(words, [...primaryFields, launch.description])) {
    return 1;
  }

  return 0;
}

export function matchesQuery(launch: SearchableLaunch, query: string): boolean {
  return queryWords(query).length === 0 || matchTier(launch, query) > 0;
}
