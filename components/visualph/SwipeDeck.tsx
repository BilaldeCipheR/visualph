"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

import { cn } from "@/lib/utils";

type SwipeDeckProps = {
  children: React.ReactNode[];
  className?: string;
  /** Accessible label for the carousel region. */
  label?: string;
};

export function SwipeDeck({ children, className, label = "Launches" }: SwipeDeckProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const count = children.length;

  const scrollTo = React.useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const clamped = Math.max(0, Math.min(count - 1, index));
    const child = track.children[clamped] as HTMLElement | undefined;
    if (child) {
      track.scrollTo({ left: child.offsetLeft - track.offsetLeft, behavior: "smooth" });
    }
  }, [count]);

  const handleScroll = React.useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < track.children.length; index += 1) {
      const child = track.children[index] as HTMLElement;
      const childCenter = child.offsetLeft - track.offsetLeft + child.clientWidth / 2;
      const distance = Math.abs(childCenter - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    }
    setActiveIndex(closest);
  }, []);

  if (count === 0) {
    return null;
  }

  return (
    <div className={cn("md:hidden", className)} role="region" aria-label={label} aria-roledescription="carousel">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {children.map((child, index) => (
          <div
            key={index}
            className="w-[82vw] max-w-85 shrink-0 snap-center"
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
          >
            {child}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => scrollTo(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Previous launch"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white/80 text-ink shadow-sm transition disabled:opacity-30"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          {children.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollTo(index)}
              aria-label={`Go to launch ${index + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === activeIndex ? "w-5 bg-ink" : "w-1.5 bg-black/20"
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollTo(activeIndex + 1)}
          disabled={activeIndex === count - 1}
          aria-label="Next launch"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white/80 text-ink shadow-sm transition disabled:opacity-30"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}