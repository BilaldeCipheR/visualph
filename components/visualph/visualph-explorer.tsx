"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  CalendarDays,
  ExternalLink,
  Filter,
  Globe2,
  Layers3,
  Tag,
  TriangleAlert
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { LaunchScreenshot } from "./launch-screenshot";

export type Launch = {
  id: string;
  name: string;
  tagline: string;
  votes: number;
  rank: number;
  category: string;
  topic: string;
  launchedAt: string;
  productHuntUrl: string;
  websiteUrl: string;
  screenshotUrl?: string | null;
};

type SortKey = "rank" | "upvotes";

type VisualPHExplorerProps = {
  availableCategories: string[];
  launches?: Launch[];
  selectedCategory: string;
  selectedDate: string;
  selectedSort: SortKey;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

function toDateValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function VisualPHExplorer({
  availableCategories,
  launches = [],
  selectedCategory,
  selectedDate,
  selectedSort
}: VisualPHExplorerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categoryFilter, setCategoryFilter] = React.useState(selectedCategory);
  const [sortKey, setSortKey] = React.useState<SortKey>(selectedSort);

  const filteredLaunches = React.useMemo(() => {
    const matched = launches.filter((launch) => {
      if (categoryFilter === "all") {
        return true;
      }

      return [launch.category, launch.topic]
        .filter(Boolean)
        .some((value) => value.toLowerCase() === categoryFilter.toLowerCase());
    });

    return [...matched].sort((left, right) => {
      if (sortKey === "upvotes") {
        return right.votes - left.votes || left.rank - right.rank;
      }

      return left.rank - right.rank || right.votes - left.votes;
    });
  }, [categoryFilter, launches, sortKey]);

  const visibleVotes = filteredLaunches.reduce((sum, launch) => sum + launch.votes, 0);
  const latestLaunch = filteredLaunches[0] ?? launches[0];

  function updateQuery(next: { category?: string; date?: string; sort?: SortKey }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.date) {
      params.set("date", next.date);
    }

    if (next.category && next.category !== "all") {
      params.set("category", next.category);
    } else {
      params.delete("category");
    }

    if (next.sort && next.sort !== "rank") {
      params.set("sort", next.sort);
    } else {
      params.delete("sort");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function handleDateChange(value: string) {
    updateQuery({
      category: categoryFilter,
      date: value,
      sort: sortKey
    });
  }

  function handleCategoryChange(value: string) {
    setCategoryFilter(value);
    updateQuery({
      category: value,
      date: selectedDate,
      sort: sortKey
    });
  }

  function handleSortChange(value: SortKey) {
    setSortKey(value);
    updateQuery({
      category: categoryFilter,
      date: selectedDate,
      sort: value
    });
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f1e8_0%,#f5efe6_100%)] text-ink">
      <section className="border-b border-black/10 bg-white/55 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-black/55">
                <Layers3 className="h-3.5 w-3.5" />
                Product Hunt launches
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  VisualPH explorer
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-black/65 sm:text-base">
                  Browse launch screenshots by day, category, and leaderboard order. The layout is
                  tuned for scanning product cards, not reading a feed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Launches" value={launches.length.toString()} />
              <Stat label="Visible votes" value={visibleVotes.toLocaleString()} />
              <Stat label="Categories" value={availableCategories.length.toString()} />
              <Stat label="Date" value={selectedDate} />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.95fr_0.85fr]">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-black/45">
                Launch date
              </span>
              <div className="flex items-center gap-2 rounded-md border border-black/10 bg-white/80 px-3 py-2 shadow-sm">
                <CalendarDays className="h-4 w-4 text-black/55" />
                <input
                  className="w-full bg-transparent text-sm text-ink outline-none"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => handleDateChange(event.target.value)}
                />
              </div>
            </label>

            <FilterSelect
              icon={<Tag className="h-4 w-4" />}
              label="Category"
              value={categoryFilter}
              onChange={handleCategoryChange}
              options={[
                { value: "all", label: "All categories" },
                ...availableCategories.map((category) => ({ value: category, label: category }))
              ]}
            />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-black/45">
                Sort
              </span>
              <div className="inline-flex rounded-md border border-black/10 bg-white/80 p-1 shadow-sm">
                <SortButton
                  active={sortKey === "rank"}
                  icon={<ArrowUpDown className="h-4 w-4" />}
                  label="By rank"
                  onClick={() => handleSortChange("rank")}
                />
                <SortButton
                  active={sortKey === "upvotes"}
                  icon={<Filter className="h-4 w-4" />}
                  label="By upvotes"
                  onClick={() => handleSortChange("upvotes")}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {launches.length === 0 ? (
          <EmptyState
            title="No launch data loaded"
            description="The UI is wired to Supabase. Once the daily sync populates products, launches for the selected date appear here."
          />
        ) : filteredLaunches.length === 0 ? (
          <EmptyState
            title="No launches match the current filters"
            description="Try a different category or pick another launch date."
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-black/10 bg-white/70 px-4 py-3 text-sm text-black/65">
              <div>
                Showing <span className="font-semibold text-ink">{filteredLaunches.length}</span>{" "}
                launch{filteredLaunches.length === 1 ? "" : "es"}
              </div>
              <div className="truncate text-right">
                Latest card: <span className="font-semibold text-ink">{latestLaunch?.name ?? "N/A"}</span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredLaunches.map((launch) => (
                <LaunchCard key={launch.id} launch={launch} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-black/10 bg-white/75 px-3 py-2 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/45">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  options
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-black/45">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-md border border-black/10 bg-white/80 px-3 py-2 shadow-sm">
        <span className="text-black/55">{icon}</span>
        <select
          className="w-full bg-transparent text-sm text-ink outline-none"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function SortButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded-[5px] px-3 py-2 text-sm font-medium transition",
        active ? "bg-ink text-white shadow-sm" : "text-black/65 hover:bg-black/5"
      )}
      onClick={onClick}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}

function LaunchCard({ launch }: { launch: Launch }) {
  return (
    <Card className="overflow-hidden bg-white/92">
      <CardHeader className="gap-3 p-4">
        <LaunchScreenshot
          name={launch.name}
          tagline={launch.tagline}
          category={launch.category}
          screenshotUrl={launch.screenshotUrl}
        />

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{launch.name}</CardTitle>
              <CardDescription className="mt-1 text-[13px] leading-5 text-black/70">
                {launch.tagline}
              </CardDescription>
            </div>
            <div className="rounded-md border border-black/10 bg-[#f8f3ea] px-2 py-1 text-right">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/45">
                Rank
              </div>
              <div className="text-sm font-semibold text-ink">#{launch.rank}</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 pt-0">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <DataPill label="Upvotes" value={launch.votes.toLocaleString()} />
          <DataPill label="Launched" value={formatLaunchDate(launch.launchedAt)} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <MetaPill icon={<Globe2 className="h-3.5 w-3.5" />} text={launch.category} />
          <MetaPill icon={<Layers3 className="h-3.5 w-3.5" />} text={launch.topic} />
        </div>

        <div className="flex flex-wrap gap-2">
          <LinkButton href={launch.productHuntUrl} label="Product Hunt" />
          <LinkButton href={launch.websiteUrl} label="Website" variant="secondary" />
        </div>
      </CardContent>
    </Card>
  );
}

function DataPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-black/10 bg-[#faf7f1] px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/45">
        {label}
      </div>
      <div className="mt-1 font-semibold text-ink">{value}</div>
    </div>
  );
}

function MetaPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/70">
      <span className="text-black/45">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

function LinkButton({
  href,
  label,
  variant = "primary"
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const primary = variant === "primary";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition",
        primary
          ? "border-ink bg-ink text-white hover:opacity-90"
          : "border-black/10 bg-white text-black/70 hover:bg-black/5"
      )}
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed bg-white/75">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="rounded-full border border-black/10 bg-[#f8f3ea] p-3 text-black/55">
          <TriangleAlert className="h-5 w-5" />
        </div>
        <div className="max-w-md space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm leading-6 text-black/65">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatLaunchDate(value: string) {
  const date = toDateValue(value);
  return date ? dateFormatter.format(date) : value;
}

