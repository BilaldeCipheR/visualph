export type ProductRecord = {
  id: string;
  slug: string;
  productHuntId: string;
  name: string;
  tagline: string;
  websiteUrl: string;
  productHuntUrl: string;
  votesCount: number;
  dailyRank: number;
  launchDate: string;
  screenshotPath: string | null;
  screenshotUrl: string | null;
  screenshotCapturedAt: string | null;
  topicSlugs: string[];
  topicNames: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProductFilterState = {
  date: string;
};
