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
      <div className="max-h-40 overflow-hidden rounded-md border border-black/10 bg-white">
        <Image
          alt={`${name} product screenshot`}
          className="h-full w-full object-cover"
          height={screenshotHeight ?? 225}
          loading="lazy"
          sizes="(min-width: 1024px) 320px, (min-width: 768px) 45vw, 100vw"
          src={screenshotUrl}
          width={screenshotWidth ?? 360}
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
      <div className="flex items-center gap-1.5 border-b border-black/10 px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b4a]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#f0c34b]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#67b38f]" />
        <span className="ml-auto text-[9px] font-medium uppercase tracking-wide text-black/45">
          {category}
        </span>
      </div>
      <div className="grid gap-2 p-2 sm:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-2 rounded-md border border-black/10 bg-white/85 p-2 shadow-sm">
          <div className="h-2.5 w-14 rounded-full bg-black/10" />
          <div className="space-y-1">
            <div className="h-3 w-3/4 rounded-full bg-black/12" />
            <div className="h-3 w-5/6 rounded-full bg-black/8" />
            <div className="h-3 w-2/3 rounded-full bg-black/8" />
          </div>
          <div className="grid grid-cols-3 gap-1 pt-1">
            <div className="rounded-md border border-black/10 bg-[#f8f3ea] p-1">
              <div className="h-2 w-6 rounded-full bg-black/15" />
              <div className="mt-1 h-3 w-7 rounded-full bg-black/12" />
            </div>
            <div className="rounded-md border border-black/10 bg-[#f8f3ea] p-1">
              <div className="h-2 w-6 rounded-full bg-black/15" />
              <div className="mt-1 h-3 w-5 rounded-full bg-black/12" />
            </div>
            <div className="rounded-md border border-black/10 bg-[#f8f3ea] p-1">
              <div className="h-2 w-6 rounded-full bg-black/15" />
              <div className="mt-1 h-3 w-4 rounded-full bg-black/12" />
            </div>
          </div>
        </div>

        <div className="rounded-md border border-black/10 bg-[#f9f6ef] p-2">
          <div className="h-16 w-full rounded-md border border-black/10 bg-[linear-gradient(180deg,rgba(255,92,53,0.18),rgba(255,92,53,0.04))]" />
          <div className="mt-2 space-y-1">
            <div className="h-2 w-full rounded-full bg-black/8" />
            <div className="h-2 w-4/5 rounded-full bg-black/8" />
            <div className="h-2 w-3/5 rounded-full bg-black/8" />
          </div>
        </div>
      </div>

      <div className="border-t border-black/10 bg-white/70 px-2 py-1">
        <div className="flex items-center gap-1.5 text-[10px] text-black/50">
          <span className="truncate font-medium text-black/70">{name}</span>
          <span className="text-black/35">•</span>
          <span className="truncate">{tagline}</span>
        </div>
      </div>
    </div>
  );
}

