"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

type LaunchScreenshotProps = {
  name: string;
  tagline: string;
  category: string;
  screenshotUrl?: string | null;
  screenshotWidth?: number | null;
  screenshotHeight?: number | null;
};

export function LaunchScreenshot({
  name,
  tagline,
  category,
  screenshotUrl,
  screenshotWidth,
  screenshotHeight
}: LaunchScreenshotProps) {
  if (screenshotUrl) {
    return (
      <div className="max-h-[34rem] touch-pan-y overflow-y-auto rounded-md border border-black/10 bg-white [scrollbar-gutter:stable]">
        <Image
          alt={`${name} product screenshot`}
          className="block h-auto w-full"
          height={screenshotHeight ?? 900}
          loading="lazy"
          sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
          src={screenshotUrl}
          width={screenshotWidth ?? 1440}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-black/10 bg-[linear-gradient(180deg,#fffdf8_0%,#f4ede2_100%)]"
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-black/10 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b4a]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f0c34b]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#67b38f]" />
        <span className="ml-auto text-[11px] font-medium uppercase tracking-wide text-black/45">
          {category}
        </span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-3 rounded-md border border-black/10 bg-white/85 p-3 shadow-sm">
          <div className="h-3 w-20 rounded-full bg-black/10" />
          <div className="space-y-2">
            <div className="h-4 w-3/4 rounded-full bg-black/12" />
            <div className="h-4 w-5/6 rounded-full bg-black/8" />
            <div className="h-4 w-2/3 rounded-full bg-black/8" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-md border border-black/10 bg-[#f8f3ea] p-2">
              <div className="h-2.5 w-8 rounded-full bg-black/15" />
              <div className="mt-2 h-5 w-10 rounded-full bg-black/12" />
            </div>
            <div className="rounded-md border border-black/10 bg-[#f8f3ea] p-2">
              <div className="h-2.5 w-8 rounded-full bg-black/15" />
              <div className="mt-2 h-5 w-8 rounded-full bg-black/12" />
            </div>
            <div className="rounded-md border border-black/10 bg-[#f8f3ea] p-2">
              <div className="h-2.5 w-8 rounded-full bg-black/15" />
              <div className="mt-2 h-5 w-7 rounded-full bg-black/12" />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-black/10 bg-[#f9f6ef] p-3">
          <div className="flex items-center justify-between">
            <div className="h-3 w-12 rounded-full bg-black/10" />
            <div className="h-3 w-8 rounded-full bg-black/8" />
          </div>
          <div className="h-28 rounded-md border border-black/10 bg-[linear-gradient(180deg,rgba(255,92,53,0.18),rgba(255,92,53,0.04))]" />
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded-full bg-black/8" />
            <div className="h-2.5 w-4/5 rounded-full bg-black/8" />
            <div className="h-2.5 w-3/5 rounded-full bg-black/8" />
          </div>
        </div>
      </div>

      <div className="border-t border-black/10 bg-white/70 px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] text-black/50">
          <span className="truncate font-medium text-black/70">{name}</span>
          <span className="text-black/35">•</span>
          <span className="truncate">{tagline}</span>
        </div>
      </div>
    </div>
  );
}
