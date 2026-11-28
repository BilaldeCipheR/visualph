"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarIcon,
  ArrowTopRightOnSquareIcon,
  Square3Stack3DIcon,
  TagIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/solid";
import { format } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { GitHubIcon } from "./github-icon";
import { GlobalSearch } from "./global-search";
import { LaunchScreenshot } from "./launch-screenshot";
import { SwipeDeck } from "./SwipeDeck";
import { matchesQuery } from "@/lib/search";

const GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/BilaldeCipheR/visualph";

export type Launch = {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  votes: number;
  rank: number;
  category: string;
  topic: string;
  launchedAt: string;
  productHuntUrl: string;
  websiteUrl: string;
  screenshotUrl?: string | null;
  screenshotWidth?: number | null;
  screenshotHeight?: number | null;
};

type VisualPHExplorerProps = {
  availableCategories: string[];
  launches?: Launch[];
  searchIndex?: Launch[];
  selectedCategory: string;
  selectedDate: string;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

function toDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  return date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
    ? date
    : null;
}

export function VisualPHExplorer({
  availableCategories,
  launches = [],
  searchIndex = [],
  selectedCategory,
  selectedDate
}: VisualPHExplorerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categoryFilter, setCategoryFilter] = React.useState(selectedCategory);
  const [searchQuery, setSearchQuery] = React.useState(() => searchParams.get("q") ?? "");
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const selectedCalendarDate = React.useMemo(
    () => toDateValue(selectedDate),
    [selectedDate]
  );
  const [calendarMonth, setCalendarMonth] = React.useState(
    () => selectedCalendarDate ?? new Date()
  );

  React.useEffect(() => {
    if (selectedCalendarDate) {
      setCalendarMonth(selectedCalendarDate);
    }
  }, [selectedCalendarDate]);

  React.useEffect(() => {
    setCategoryFilter(selectedCategory);
    setSearchQuery(searchParams.get("q") ?? "");
  }, [searchParams, selectedCategory]);

  const filteredLaunches = React.useMemo(() => {
    const matched = launches.filter((launch) => {
      if (!matchesQuery(launch, searchQuery)) {
        return false;
      }

      if (categoryFilter === "all") {
        return true;
      }

      return [launch.category, launch.topic]
        .filter(Boolean)
        .some((value) => value.toLowerCase() === categoryFilter.toLowerCase());
    });

    return [...matched].sort(
      (left, right) => right.votes - left.votes || left.rank - right.rank
    );
  }, [categoryFilter, launches, searchQuery]);

  function updateQuery(next: { category?: string; date?: string; q?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const query = next.q ?? searchQuery;

    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }

    if (next.date) {
      params.set("date", next.date);
    }

    if (next.category && next.category !== "all") {
      params.set("category", next.category);
    } else {
      params.delete("category");
    }

    params.delete("sort");

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }

  function handleDateChange(value: string) {
    updateQuery({
      category: categoryFilter,
      date: value
    });
  }

  function handleSearchSubmit(value: string) {
    setSearchQuery(value);
    updateQuery({ category: categoryFilter, date: selectedDate, q: value });
  }

  function handleCategoryChange(value: string) {
    setCategoryFilter(value);
    updateQuery({
      category: value,
      date: selectedDate
    });
  }


  return (
    <main className="min-h-screen text-ink">
      <section className="border-b border-black/10 bg-white/55 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-black/55">
                <Square3Stack3DIcon className="h-3.5 w-3.5" />
                Product Hunt launches
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  VisualPH explorer
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-black/65 sm:text-base">
                  Browse launch screenshots by day and category, ordered by upvotes. The layout is
                  tuned for scanning product cards, not reading a feed.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-2 border-black/10 bg-white/80 text-ink shadow-sm hover:bg-white"
              >
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View the source on GitHub"
                >
                  <GitHubIcon className="h-4 w-4" />
                  GitHub
                </a>
              </Button>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Stat label="Launches" value={launches.length.toString()} />
                <Stat label="Categories" value={availableCategories.length.toString()} />
                <Stat label="Date" value={selectedDate.slice(5)} />
              </div>
            </div>
          </div>

          <GlobalSearch
            launches={launches}
            index={searchIndex}
            selectedDate={selectedDate}
            onOpenLaunch={(launch) => {
              setSearchQuery(launch.name);
              setCategoryFilter("all");
              updateQuery({
                category: "all",
                date: launch.launchedAt.slice(0, 10),
                q: launch.name
              });
            }}
            categories={availableCategories}
            query={searchQuery}
            onSubmit={handleSearchSubmit}
            onPickCategory={handleCategoryChange}
          />

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-black/45">
                Launch date
              </span>
              <Popover
                open={calendarOpen}
                onOpenChange={(open) => {
                  setCalendarOpen(open);
                  if (open && selectedCalendarDate) {
                    setCalendarMonth(selectedCalendarDate);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-md border-black/10 bg-white/80 shadow-sm hover:bg-white/90 text-ink",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-black/55" />
                    {selectedDate ? formatLaunchDate(selectedDate) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border-black/10" align="start">
                  <Calendar
                    mode="single"
                    showOutsideDays={false}
                    startMonth={new Date(2026, 0, 1)}
                    selected={selectedCalendarDate || undefined}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    onSelect={(date) => {
                      if (date) {
                        setCalendarOpen(false);
                        handleDateChange(format(date, "yyyy-MM-dd"));
                      }
                    }}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <FilterSelect
              icon={<TagIcon className="h-4 w-4" />}
              label="Category"
              value={categoryFilter}
              onChange={handleCategoryChange}
              options={[
                { value: "all", label: "All categories" },
                ...availableCategories.map((category) => ({ value: category, label: category }))
              ]}
            />

            <FilterSelect
              icon={<Square3Stack3DIcon className="h-4 w-4" />}
              label="Sort"
              value="votes"
              onChange={() => {}}
              options={[{ value: "votes", label: "Most upvoted" }]}
            />

          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {launches.length === 0 ? (
          <EmptyState
            title="No launches for this day yet"
            description={`Nothing has launched on ${formatLaunchDate(selectedDate)} so far. Pick another date from the calendar, or search every day from the bar above.`}
          />
        ) : filteredLaunches.length === 0 ? (
          <EmptyState
            title={
              searchQuery
                ? `No launches match “${searchQuery}”`
                : "No launches match the current filters"
            }
            description={
              searchQuery
                ? "Try a shorter word, clear the category, or pick another launch date."
                : "Try a different category or pick another launch date."
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-2 rounded-md border border-black/10 bg-white/70 px-4 py-3 text-sm text-black/65 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div>
                Showing <span className="font-semibold text-ink">{filteredLaunches.length}</span>{" "}
                launch{filteredLaunches.length === 1 ? "" : "es"}
                {searchQuery ? (
                  <>
                    {" "}matching <span className="font-semibold text-ink">“{searchQuery}”</span>
                  </>
                ) : null}
              </div>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => handleSearchSubmit("")}
                  className="text-sm font-medium text-black/60 underline-offset-4 hover:underline"
                >
                  Clear search
                </button>
              ) : null}
            </div>
            <SwipeDeck label="Launches">
              {filteredLaunches.map((launch) => (
                <LaunchCard key={launch.id} launch={launch} />
              ))}
            </SwipeDeck>
            <div className="hidden items-start gap-5 md:grid md:grid-cols-2 lg:grid-cols-3">
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
    <div className="rounded-md border border-black/10 bg-white/75 px-2 py-2 shadow-sm sm:px-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/45 sm:text-[11px] sm:tracking-[0.16em]">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-ink sm:text-lg">{value}</div>
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
          className="w-full cursor-pointer appearance-none bg-transparent text-sm text-ink outline-none"
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

function LaunchCard({ launch }: { launch: Launch }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden bg-white/92">
      <div className="border-b border-black/10 bg-[#f8f3ea] p-3">
        <LaunchScreenshot
          name={launch.name}
          tagline={launch.tagline}
          category={launch.category}
          screenshotUrl={launch.screenshotUrl}
          screenshotWidth={launch.screenshotWidth}
          screenshotHeight={launch.screenshotHeight}
        />
      </div>

      <div className="flex flex-1 flex-col">
        <CardHeader className="gap-3 p-5">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-xl">{launch.name}</CardTitle>
                <CardDescription className="mt-2 text-sm leading-6 text-black/70">
                  {launch.tagline}
                </CardDescription>
              </div>
              <div className="shrink-0 rounded-md border border-black/10 bg-[#f8f3ea] px-2 py-1 text-right">
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/45">
                  Rank
                </div>
                <div className="text-sm font-semibold text-ink">#{launch.rank}</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="mt-auto space-y-3 p-5 pt-0">
          <DataPill label="Upvotes" value={launch.votes.toLocaleString()} />
          <div className="flex flex-wrap gap-2">
            <LinkButton href={launch.productHuntUrl} label="Product Hunt" />
            <LinkButton href={launch.websiteUrl} label="Website" variant="secondary" />
          </div>
        </CardContent>
      </div>
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
          ? "border-ink bg-ink text-primary-foreground hover:opacity-90"
          : "border-black/10 bg-white text-ink hover:bg-black/5"
      )}
    >
      {label}
      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
    </a>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed bg-white/75">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="rounded-full border border-black/10 bg-[#f8f3ea] p-3 text-black/55">
          <ExclamationTriangleIcon className="h-5 w-5" />
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
