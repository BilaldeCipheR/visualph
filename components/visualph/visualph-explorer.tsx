"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ExternalLink,
  Globe2,
  Layers3,
  Tag,
  TriangleAlert
} from "lucide-react";
import { format } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  screenshotWidth?: number | null;
  screenshotHeight?: number | null;
};

type VisualPHExplorerProps = {
  availableCategories: string[];
  launches?: Launch[];
  selectedCategory: string;
  selectedDate: string;
  selectedSort: "votes" | "rank" | "name";
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
  selectedCategory,
  selectedDate,
  selectedSort
}: VisualPHExplorerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categoryFilter, setCategoryFilter] = React.useState(selectedCategory);
  const [sortOrder, setSortOrder] = React.useState(selectedSort);
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
      if (sortOrder === "rank") return left.rank - right.rank;
      if (sortOrder === "name") return left.name.localeCompare(right.name);
      return right.votes - left.votes || left.rank - right.rank;
    });
  }, [categoryFilter, launches, sortOrder]);

  function updateQuery(next: { category?: string; date?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.date) {
      params.set("date", next.date);
    }

    if (next.category && next.category !== "all") {
      params.set("category", next.category);
    } else {
      params.delete("category");
    }

    if (next.sort && next.sort !== "votes") {
      params.set("sort", next.sort);
    } else {
      params.delete("sort");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handleDateChange(value: string) {
    updateQuery({
      category: categoryFilter,
      date: value,
      sort: sortOrder
    });
  }

  function handleCategoryChange(value: string) {
    setCategoryFilter(value);
    updateQuery({
      category: value,
      date: selectedDate,
      sort: sortOrder
    });
  }

  function handleSortChange(value: string) {
    const nextSort = value as "votes" | "rank" | "name";
    setSortOrder(nextSort);
    updateQuery({ category: categoryFilter, date: selectedDate, sort: nextSort });
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
                  Browse launch screenshots by day and category, ordered by upvotes. The layout is
                  tuned for scanning product cards, not reading a feed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Launches" value={launches.length.toString()} />
              <Stat label="Categories" value={availableCategories.length.toString()} />
              <Stat label="Date" value={selectedDate} />
            </div>
          </div>

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
                    <CalendarDays className="mr-2 h-4 w-4 text-black/55" />
                    {selectedDate ? formatLaunchDate(selectedDate) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border-black/10" align="start">
                  <Calendar
                    mode="single"
                    showOutsideDays={false}
                    fromMonth={new Date(2026, 0, 1)}
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
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

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

            <FilterSelect
              icon={<Layers3 className="h-4 w-4" />}
              label="Sort"
              value={sortOrder}
              onChange={handleSortChange}
              options={[
                { value: "votes", label: "Most upvoted" },
                { value: "rank", label: "Daily rank" },
                { value: "name", label: "Product name" }
              ]}
            />

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
            </div>
            <div className="space-y-5">
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

function LaunchCard({ launch }: { launch: Launch }) {
  return (
    <Card className="grid overflow-hidden bg-white/92 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div>
      <CardHeader className="gap-3 p-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl">{launch.name}</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6 text-black/70">
                {launch.tagline}
              </CardDescription>
            </div>
            <div className="rounded-md border border-black/10 bg-[#f8f3ea] px-2 py-1 text-right">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/45">Rank</div>
              <div className="text-sm font-semibold text-ink">#{launch.rank}</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0">
        <DataPill label="Upvotes" value={launch.votes.toLocaleString()} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <MetaPill icon={<Globe2 className="h-3.5 w-3.5" />} text={launch.category} />
          <MetaPill icon={<Layers3 className="h-3.5 w-3.5" />} text={launch.topic} />
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={launch.productHuntUrl} label="Product Hunt" />
          <LinkButton href={launch.websiteUrl} label="Website" variant="secondary" />
        </div>
      </CardContent>
      </div>

      <div className="border-t border-black/10 bg-[#f8f3ea] p-4 lg:border-l lg:border-t-0">
        <LaunchScreenshot
          name={launch.name}
          tagline={launch.tagline}
          category={launch.category}
          screenshotUrl={launch.screenshotUrl}
          screenshotWidth={launch.screenshotWidth}
          screenshotHeight={launch.screenshotHeight}
        />
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
