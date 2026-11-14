"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CalendarDays,
  CornerDownLeft,
  History,
  Search,
  Tag,
  X
} from "lucide-react";

import { matchTier, matchesQuery, queryWords } from "@/lib/search";
import { cn } from "@/lib/utils";

import type { Launch } from "./visualph-explorer";

const RECENT_KEY = "visualph-recent-searches";
const RECENT_LIMIT = 5;
const SEARCH_DEBOUNCE_MS = 150;

type GlobalSearchProps = {
  launches: Launch[];
  index?: Launch[];
  selectedDate: string;
  onOpenLaunch: (launch: Launch) => void;
  categories: string[];
  query: string;
  onSubmit: (query: string) => void;
  onPickCategory: (category: string) => void;
};

type Result =
  | { kind: "launch"; key: string; launch: Launch }
  | { kind: "category"; key: string; category: string; count: number }
  | { kind: "all"; key: string; query: string; count: number }
  | { kind: "recent"; key: string; query: string };

const TIER_LABELS: Record<number, string> = {
  3: "Name matches",
  2: "Matches the tagline or category",
  1: "Matches the description"
};

const dayFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric"
});
const shortDayFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric"
});

function readRecent(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Recent searches are optional when browser storage is unavailable.
  }
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}

export function GlobalSearch({
  launches,
  index,
  selectedDate,
  onOpenLaunch,
  categories,
  query,
  onSubmit,
  onPickCategory
}: GlobalSearchProps) {
  const pool = index && index.length > 0 ? index : launches;
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(query);
  const [active, setActive] = React.useState(0);
  const [recent, setRecent] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debouncedDraft = useDebouncedValue(draft, SEARCH_DEBOUNCE_MS);
  const dayCount = React.useMemo(
    () => new Set(pool.map((launch) => launch.launchedAt.slice(0, 10))).size,
    [pool]
  );

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(query);
    setRecent(readRecent());
    setActive(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, query]);

  const results = React.useMemo<Result[]>(() => {
    const normalizedQuery = debouncedDraft.trim();
    const launchResults = normalizedQuery
      ? pool
          .filter((launch) => matchesQuery(launch, normalizedQuery))
          .sort((left, right) => {
            const leftDay = left.launchedAt.slice(0, 10);
            const rightDay = right.launchedAt.slice(0, 10);
            return (
              matchTier(right, normalizedQuery) - matchTier(left, normalizedQuery) ||
              Number(rightDay === selectedDate) - Number(leftDay === selectedDate) ||
              rightDay.localeCompare(leftDay) ||
              right.votes - left.votes
            );
          })
          .slice(0, 8)
      : [];
    const categoryResults = categories
      .filter(
        (category) =>
          !normalizedQuery || category.toLowerCase().includes(normalizedQuery.toLowerCase())
      )
      .slice(0, 3)
      .map((category) => ({
        kind: "category" as const,
        key: `category-${category}`,
        category,
        count: launches.filter((launch) =>
          [launch.category, launch.topic].some(
            (value) => value?.toLowerCase() === category.toLowerCase()
          )
        ).length
      }));
    const next: Result[] = [];

    if (!normalizedQuery) {
      next.push(
        ...recent.map((term) => ({
          kind: "recent" as const,
          key: `recent-${term}`,
          query: term
        }))
      );
    } else {
      const selectedDayCount = launches.filter((launch) =>
        matchesQuery(launch, normalizedQuery)
      ).length;

      if (selectedDayCount > 0) {
        next.push({
          kind: "all",
          key: "all",
          query: debouncedDraft.trim(),
          count: selectedDayCount
        });
      }
    }

    next.push(
      ...launchResults.map((launch) => ({
        kind: "launch" as const,
        key: `launch-${launch.id}-${launch.launchedAt}`,
        launch
      }))
    );
    next.push(...categoryResults);
    return next;
  }, [categories, debouncedDraft, launches, pool, recent, selectedDate]);

  React.useEffect(() => {
    setActive(0);
  }, [debouncedDraft]);

  React.useEffect(() => {
    if (active >= results.length) {
      setActive(Math.max(0, results.length - 1));
    }
  }, [active, results.length]);

  function remember(value: string) {
    const term = value.trim();

    if (!term) {
      return;
    }

    setRecent((current) => {
      const next = [
        term,
        ...current.filter((item) => item.toLowerCase() !== term.toLowerCase())
      ].slice(0, RECENT_LIMIT);
      writeRecent(next);
      return next;
    });
  }

  function clearRecent() {
    setRecent([]);
    writeRecent([]);
  }

  function choose(result: Result | undefined) {
    if (!result) {
      return;
    }

    if (result.kind === "recent") {
      setDraft(result.query);
      inputRef.current?.focus();
      return;
    }

    remember(draft);

    if (result.kind === "all") {
      onSubmit(result.query);
    } else if (result.kind === "category") {
      onPickCategory(result.category);
    } else {
      onOpenLaunch(result.launch);
    }

    setOpen(false);
  }

  const launchResults = results.filter((result) => result.kind === "launch");
  const categoryResults = results.filter((result) => result.kind === "category");
  const recentResults = results.filter((result) => result.kind === "recent");
  const allResult = results.find((result) => result.kind === "all");
  const hasNoResults =
    Boolean(debouncedDraft.trim()) &&
    launchResults.length === 0 &&
    categoryResults.length === 0 &&
    !allResult;

  return (
    <>
      <div className="flex w-full items-center gap-3 rounded-md border border-black/10 bg-white/90 px-4 py-3 text-sm shadow-sm transition hover:bg-white focus-within:ring-2 focus-within:ring-black/20">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
          aria-haspopup="dialog"
        >
          <Search className="h-4 w-4 text-black/55" />
          <span className={cn("flex-1 truncate", query ? "text-ink" : "text-black/45")}>
            {query || "Search by name, or by what it does"}
          </span>
        </button>
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSubmit("")}
            className="rounded p-1 text-black/45 hover:bg-black/5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <kbd className="rounded border border-black/10 bg-[#f8f3ea] px-1.5 py-0.5 font-mono text-[11px] text-black/55">
          ⌘K
        </kbd>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 px-4 pt-[12vh] backdrop-blur-[2px]"
              onMouseDown={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Search launches"
                onMouseDown={(event) => event.stopPropagation()}
                className="w-full max-w-xl overflow-hidden rounded-lg border border-black/10 bg-white shadow-2xl"
              >
                <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3">
                  <Search className="h-4 w-4 text-black/55" />
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActive((index) => Math.min(index + 1, results.length - 1));
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActive((index) => Math.max(index - 1, 0));
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        choose(results[active]);
                      } else if (event.key === "Escape") {
                        setOpen(false);
                      }
                    }}
                    placeholder="Search by name, or by what it does"
                    className="flex-1 bg-transparent text-base text-ink outline-none placeholder:text-black/40"
                    aria-label="Search launches"
                  />
                  <kbd className="rounded border border-black/10 bg-[#f8f3ea] px-1.5 py-0.5 font-mono text-[11px] text-black/55">
                    Esc
                  </kbd>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
                  {recentResults.length > 0 ? (
                    <div className="flex items-center justify-between pr-3">
                      <GroupLabel>Recent searches</GroupLabel>
                      <button
                        type="button"
                        onClick={clearRecent}
                        className="pt-3 text-[11px] font-medium text-black/45 hover:text-ink"
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                  {recentResults.map((result) =>
                    result.kind === "recent" ? (
                      <ResultRow
                        key={result.key}
                        active={results[active]?.key === result.key}
                        onHover={() => setActive(results.indexOf(result))}
                        onClick={() => choose(result)}
                      >
                        <History className="h-4 w-4 text-black/45" />
                        <span className="flex-1 truncate text-ink">{result.query}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-black/35" />
                      </ResultRow>
                    ) : null
                  )}

                  {allResult?.kind === "all" ? (
                    <ResultRow
                      active={results[active]?.key === allResult.key}
                      onHover={() => setActive(results.indexOf(allResult))}
                      onClick={() => choose(allResult)}
                    >
                      <Search className="h-4 w-4 text-black/55" />
                      <span className="flex-1 truncate">
                        Filter {formatDay(selectedDate)} by{" "}
                        <span className="font-semibold text-ink">“{allResult.query}”</span>
                      </span>
                      <span className="text-xs text-black/45">
                        {allResult.count} on this day
                      </span>
                    </ResultRow>
                  ) : null}

                  {launchResults.map((result, index) => {
                    if (result.kind !== "launch") {
                      return null;
                    }

                    const previous = launchResults[index - 1];
                    const showTier =
                      index === 0 ||
                      (previous.kind === "launch" &&
                        matchTier(previous.launch, debouncedDraft) !==
                          matchTier(result.launch, debouncedDraft));

                    return (
                      <React.Fragment key={result.key}>
                        {showTier ? (
                          <GroupLabel>
                            {TIER_LABELS[matchTier(result.launch, debouncedDraft)]}
                          </GroupLabel>
                        ) : null}
                        <ResultRow
                          active={results[active]?.key === result.key}
                          onHover={() => setActive(results.indexOf(result))}
                          onClick={() => choose(result)}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black/10 bg-[#f8f3ea] text-xs font-semibold text-ink">
                            #{result.launch.rank}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">
                              {result.launch.name}
                            </span>
                            {matchTier(result.launch, debouncedDraft) === 1 &&
                            result.launch.description ? (
                              <DescriptionExcerpt
                                text={result.launch.description}
                                query={debouncedDraft}
                              />
                            ) : (
                              <span className="block truncate text-xs text-black/55">
                                {result.launch.tagline}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-black/45">
                            ▲ {result.launch.votes.toLocaleString()}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded border border-black/10 bg-[#faf7f1] px-1.5 py-0.5 text-[11px] text-black/55">
                            <CalendarDays className="h-3 w-3" />
                            {formatDay(result.launch.launchedAt, true)}
                          </span>
                        </ResultRow>
                      </React.Fragment>
                    );
                  })}

                  {categoryResults.length > 0 ? <GroupLabel>Categories</GroupLabel> : null}
                  {categoryResults.map((result) =>
                    result.kind === "category" ? (
                      <ResultRow
                        key={result.key}
                        active={results[active]?.key === result.key}
                        onHover={() => setActive(results.indexOf(result))}
                        onClick={() => choose(result)}
                      >
                        <Tag className="h-4 w-4 text-black/55" />
                        <span className="flex-1 truncate text-ink">{result.category}</span>
                        <span className="text-xs text-black/45">Filter</span>
                        <ArrowRight className="h-3.5 w-3.5 text-black/45" />
                      </ResultRow>
                    ) : null
                  )}

                  {hasNoResults ? (
                    <div className="px-3 py-8 text-center text-sm text-black/55">
                      No launches match “{debouncedDraft.trim()}” on any day. Try a shorter word.
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-4 border-t border-black/10 bg-[#faf7f1] px-4 py-2 text-[11px] text-black/50">
                  <span className="inline-flex items-center gap-1">
                    <kbd className="font-mono">↑↓</kbd> to move
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CornerDownLeft className="h-3 w-3" /> opens that day
                  </span>
                  <span className="ml-auto">
                    Searching {pool.length.toLocaleString()} launches across {dayCount} days
                  </span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function DescriptionExcerpt({ text, query }: { text: string; query: string }) {
  const words = queryWords(query);
  const lower = text.toLowerCase();
  const indexes = words.map((word) => lower.indexOf(word)).filter((index) => index >= 0);
  const first = indexes.length > 0 ? Math.min(...indexes) : 0;
  const roughStart = Math.max(0, first - 40);
  const wordBoundary = roughStart === 0 ? 0 : text.indexOf(" ", roughStart);
  const start = wordBoundary >= 0 ? wordBoundary + Number(roughStart > 0) : roughStart;
  const excerpt = `${start > 0 ? "…" : ""}${text.slice(start, start + 110).trim()}${
    start + 110 < text.length ? "…" : ""
  }`;
  const pattern = new RegExp(
    `(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );

  return (
    <span className="mt-0.5 block truncate text-xs text-black/55">
      {excerpt.split(pattern).map((part, index) =>
        words.includes(part.toLowerCase()) ? (
          <mark key={`${part}-${index}`} className="bg-transparent font-semibold text-ink">
            {part}
          </mark>
        ) : (
          <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-black/45">
      {children}
    </div>
  );
}

function ResultRow({
  active,
  onHover,
  onClick,
  children
}: {
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseMove={onHover}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-black/70",
        active && "bg-[#f3ece0] text-ink"
      )}
    >
      {children}
    </button>
  );
}

function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function formatDay(value: string, short = false) {
  const date = parseDay(value);
  return date ? (short ? shortDayFormatter : dayFormatter).format(date) : value;
}
