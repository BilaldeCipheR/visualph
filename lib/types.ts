export type ProductRecord = {
  id: string;
  name: string;
  tagline: string;
  websiteUrl: string;
  productHuntUrl: string;
  votesCount: number;
  dailyRank: number;
  launchDate: string;
  screenshotUrl: string | null;
  screenshotWidth: number | null;
  screenshotHeight: number | null;
  topicNames: string[];
};

export type ProductFilterState = {
  date: string;
};
