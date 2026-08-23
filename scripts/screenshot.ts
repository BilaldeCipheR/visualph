import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { requireEnv } from "../lib/env";
import {
  selectProductMediaUrl,
  summarizeScreenshotBatch
} from "../lib/screenshot-fallback";
import {
  DEFAULT_SCREENSHOT_REFRESH_AFTER_DAYS,
  screenshotCandidateFilter
} from "../lib/screenshot-policy";
import { optimizeScreenshot, SCREENSHOT_CONTENT_TYPE } from "../lib/screenshot-image";
import { buildScreenshotStoragePath } from "../lib/screenshot-path";
import { attemptScreenshotUpload } from "../lib/screenshot-upload";

type JsonRecord = Record<string, unknown>;

type CliOptions = {
  all: boolean;
  bucket: string;
  date?: string;
  id?: string;
  json: boolean;
  limit: number;
  pathPrefix: string;
  preferMedia: boolean;
  refreshAfterDays: number;
  slug?: string;
  table: string;
  timeoutMs: number;
};

type ProductTarget = {
  fallbackImageUrl: string | null;
  id: string;
  screenshotAttemptCount: number;
  launchDate: string;
  name: string;
  slug: string;
  url: string;
};

type CaptureResult = {
  buffer: Buffer;
  captureStatus: "captured" | "fallback";
  captureSource?: "product-media" | "website";
  contentType?: string;
  failurePhase?: "media" | "navigation" | "screenshot" | "unknown" | "upload";
  failureReason?: string;
  height?: number;
  width?: number;
};

type ProductRunResult = {
  captureStatus: CaptureResult["captureStatus"];
  captureSource?: CaptureResult["captureSource"];
  failurePhase?: CaptureResult["failurePhase"];
  failureReason?: string;
  id: string;
  name: string;
  screenshotPath: string | null;
  screenshotUrl: string | null;
  slug: string;
  url: string;
};

type BrowserPage = {
  close(): Promise<void>;
  evaluate<T>(pageFunction: () => T): Promise<T>;
  goto(url: string, options: { timeout: number; waitUntil: "networkidle2" | "domcontentloaded" }): Promise<unknown>;
  screenshot(options: { fullPage: boolean; type: "png"; timeout: number }): Promise<Uint8Array>;
  setUserAgent(userAgent: string): Promise<void>;
  setViewport(viewport: { width: number; height: number }): Promise<void>;
  url(): string;
};

type BrowserInstance = {
  close(): Promise<void>;
  newPage(): Promise<BrowserPage>;
};

type PuppeteerLike = {
  launch(options: { headless: true; args: string[]; userDataDir: string }): Promise<BrowserInstance>;
};

const VIEWPORT = { width: 1440, height: 900 } as const;
const DEFAULT_BUCKET = "screenshots";
const DEFAULT_PATH_PREFIX = "products";
const DEFAULT_TABLE = "products";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_LIMIT = 20;
const SUPPORTED_FALLBACK_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const supabase = createServiceClient();
  const products = await resolveTargets(supabase, options);

  if (products.length === 0) {
    logJson(options.json, {
      ok: true,
      processed: 0,
      results: []
    });
    return;
  }

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    userDataDir: mkdtempSync(join(tmpdir(), "visualph-chrome-"))
  });

  const results: ProductRunResult[] = [];

  try {
    for (const product of products) {
      try {
        const result = await processProduct({ browser, options, product, supabase });
        results.push(result);
      } catch (error) {
        const failureReason = toErrorMessage(error);
        console.error(`[screenshot] unexpected failure for ${product.slug}: ${failureReason}`);
        results.push({
          captureStatus: "fallback",
          failurePhase: "unknown",
          failureReason,
          id: product.id,
          name: product.name,
          screenshotPath: null,
          screenshotUrl: null,
          slug: product.slug,
          url: product.url
        });
      }
    }
  } finally {
    await browser.close();
  }

  const summary = summarizeScreenshotBatch(results);

  if (summary.status === "partial") {
    console.warn(
      `[screenshot] ${summary.failed} of ${summary.processed} captures failed and remain queued for retry`
    );
  }

  logJson(options.json, {
    fallbackCount: summary.failed,
    ok: summary.status !== "failed",
    processed: summary.processed,
    results
  });

  if (summary.status === "failed") {
    throw new Error(`All ${summary.processed} screenshot captures failed.`);
  }
}

async function processProduct(input: {
  browser: BrowserInstance;
  options: CliOptions;
  product: ProductTarget;
  supabase: SupabaseClient;
}) {
  const { browser, options, product, supabase } = input;
  const preferredMediaCapture =
    options.preferMedia && product.fallbackImageUrl
      ? await captureProductMedia(product.fallbackImageUrl, options.timeoutMs)
      : null;
  const websiteCapture =
    preferredMediaCapture?.captureStatus === "captured"
      ? null
      : await captureProduct(browser, product.url, options.timeoutMs);
  const rawCapture =
    preferredMediaCapture?.captureStatus === "captured"
      ? preferredMediaCapture
      : websiteCapture?.captureStatus === "fallback" && product.fallbackImageUrl
        ? await captureProductMedia(product.fallbackImageUrl, options.timeoutMs)
        : websiteCapture!;
  let capture = rawCapture;

  if (rawCapture.captureStatus === "captured") {
    try {
      const optimized = await optimizeScreenshot(rawCapture.buffer);
      capture = {
        ...rawCapture,
        buffer: optimized.buffer,
        contentType: optimized.contentType,
        height: optimized.height,
        width: optimized.width
      };
    } catch (error) {
      capture = buildFallbackCapture("screenshot", error, product.url);
    }
  }
  const screenshotPath =
    capture.captureStatus === "captured"
      ? buildScreenshotStoragePath({
          launchDate: product.launchDate,
          pathPrefix: options.pathPrefix,
          productId: product.id,
          slug: product.slug
        })
      : null;
  const uploadAttempt =
    capture.captureStatus === "captured" && screenshotPath
      ? await attemptScreenshotUpload(() =>
          uploadScreenshotBuffer({
            bucket: options.bucket,
            buffer: capture.buffer,
            contentType: SCREENSHOT_CONTENT_TYPE,
            path: screenshotPath,
            supabase
          })
        )
      : null;
  const finalCapture =
    uploadAttempt && !uploadAttempt.ok
      ? buildFallbackCapture("upload", uploadAttempt.error, product.url)
      : capture;
  const screenshotUrl = uploadAttempt?.ok ? uploadAttempt.value : null;

  await updateScreenshotMetadata({
    capture: finalCapture,
    options,
    product,
    screenshotPath: screenshotUrl ? screenshotPath : null,
    screenshotUrl,
    supabase
  });

  return {
    captureStatus: finalCapture.captureStatus,
    captureSource: finalCapture.captureSource,
    failurePhase: finalCapture.failurePhase,
    failureReason: finalCapture.failureReason,
    id: product.id,
    name: product.name,
    screenshotPath: screenshotUrl ? screenshotPath : null,
    screenshotUrl,
    slug: product.slug,
    url: product.url
  } satisfies ProductRunResult;
}

async function resolveTargets(supabase: SupabaseClient, options: CliOptions) {
  if (options.id || options.slug) {
    let query = supabase.from(options.table).select("*").limit(1);

    if (options.id) {
      query = query.eq("id", options.id);
    } else if (options.slug) {
      query = query.eq("slug", options.slug);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to load product target: ${error.message}`);
    }

    if (!data) {
      throw new Error("No matching product found for the requested target.");
    }

    return [toProductTarget(data)];
  }

  let query = supabase
    .from(options.table)
    .select("*")
    .or(screenshotCandidateFilter(options.refreshAfterDays, new Date(), Boolean(options.date)))
    .order("launch_date", { ascending: false })
    .order("votes_count", { ascending: false });

  if (options.date) {
    query = query.eq("launch_date", options.date);
  }

  if (!options.all) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load screenshot batch: ${error.message}`);
  }

  return (data ?? []).map(toProductTarget);
}

async function captureProduct(browser: BrowserInstance, url: string, timeoutMs: number): Promise<CaptureResult> {
  const page = await browser.newPage();

  try {
    await page.setViewport(VIEWPORT);
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
    );

    try {
      await page.goto(url, {
        timeout: timeoutMs,
        waitUntil: "networkidle2"
      });
    } catch (firstError) {
      console.warn(`[screenshot] networkidle2 retry for ${url}: ${toErrorMessage(firstError)}`);
      try {
        await page.goto(url, {
          timeout: timeoutMs,
          waitUntil: "domcontentloaded"
        });
      } catch (error) {
        return buildFallbackCapture("navigation", error, url);
      }
    }

    try {
      await scrollLazyContent(page);

      if (isProductHuntUrl(page.url())) {
        return buildFallbackCapture(
          "navigation",
          new Error("Product Hunt did not redirect to the external product website."),
          url
        );
      }
    } catch (error) {
      return buildFallbackCapture("navigation", error, url);
    }

    try {
      const screenshot = await page.screenshot({
        fullPage: true,
        type: "png",
        timeout: timeoutMs
      });
      const buffer = Buffer.from(screenshot);
      const { height, width } = readPngDimensions(buffer);

      return {
        buffer,
        captureStatus: "captured",
        captureSource: "website",
        contentType: "image/png",
        height,
        width
      };
    } catch (error) {
      return buildFallbackCapture("screenshot", error, url);
    }
  } finally {
    await page.close();
  }
}

async function captureProductMedia(url: string, timeoutMs: number): Promise<CaptureResult> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "image/*"
      }
    });

    if (!response.ok) {
      throw new Error(`Product media request returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
    if (!contentType || !SUPPORTED_FALLBACK_IMAGE_TYPES.has(contentType)) {
      throw new Error(`Product media returned unsupported content type: ${contentType ?? "missing"}.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error("Product media response was empty.");
    }

    const dimensions = contentType === "image/png" ? readPngDimensions(buffer) : {};
    console.warn(`[screenshot] using Product Hunt media fallback for ${url}`);

    return {
      buffer,
      captureStatus: "captured",
      captureSource: "product-media",
      contentType,
      ...dimensions
    };
  } catch (error) {
    return buildFallbackCapture("media", error, url);
  }
}

function buildFallbackCapture(
  phase: CaptureResult["failurePhase"],
  error: unknown,
  url: string
): CaptureResult {
  const message = toErrorMessage(error);

  console.warn(`[screenshot] fallback for ${url} during ${phase}: ${message}`);

  return {
    buffer: Buffer.alloc(0),
    captureStatus: "fallback",
    failurePhase: phase ?? "unknown",
    failureReason: message
  };
}

async function uploadScreenshotBuffer(input: {
  bucket: string;
  buffer: Buffer;
  contentType: string;
  path: string;
  supabase: SupabaseClient;
}) {
  const { bucket, buffer, contentType, path, supabase } = input;
  const storage = supabase.storage.from(bucket);
  const { error } = await storage.upload(path, buffer, {
    contentType,
    upsert: true
  });

  if (error) {
    throw new Error(`Failed to upload screenshot ${path}: ${error.message}`);
  }

  const { data } = storage.getPublicUrl(path);
  return data.publicUrl;
}

async function updateScreenshotMetadata(input: {
  capture: CaptureResult;
  options: CliOptions;
  product: ProductTarget;
  screenshotPath: string | null;
  screenshotUrl: string | null;
  supabase: SupabaseClient;
}) {
  const { capture, options, product, screenshotPath, screenshotUrl, supabase } = input;
  const now = new Date().toISOString();
  const updatePayload: JsonRecord =
    capture.captureStatus === "captured"
      ? {
          screenshot_status: "captured",
          screenshot_source:
            capture.captureSource === "product-media" ? "product-media" : "website",
          screenshot_error: null,
          screenshot_attempt_count: product.screenshotAttemptCount + 1,
          screenshot_last_attempted_at: now,
          screenshot_bucket: options.bucket,
          screenshot_path: screenshotPath,
          screenshot_url: screenshotUrl,
          screenshot_width: capture.width ?? null,
          screenshot_height: capture.height ?? null,
          screenshot_bytes: capture.buffer.byteLength,
          screenshot_mime_type: SCREENSHOT_CONTENT_TYPE,
          screenshot_captured_at: now
        }
      : {
          screenshot_status: "fallback",
          screenshot_error: capture.failureReason ?? "Unknown screenshot failure",
          screenshot_attempt_count: product.screenshotAttemptCount + 1,
          screenshot_last_attempted_at: now
        };

  const { error } = await supabase
    .from(options.table)
    .update(updatePayload)
    .eq("id", product.id);

  if (error) {
    throw new Error(`Failed to update screenshot metadata for ${product.slug}: ${error.message}`);
  }

  if (capture.captureStatus === "fallback") {
    console.warn(`[screenshot] capture failed for ${product.slug}; leaving it queued for retry`);
  } else {
    console.log(`[screenshot] captured ${product.slug} -> ${screenshotPath}`);
  }
}

function readPngDimensions(buffer: Buffer) {
  const pngSignature = "89504e470d0a1a0a";

  if (
    buffer.length < 24 ||
    buffer.subarray(0, 8).toString("hex") !== pngSignature ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    throw new Error("Captured screenshot is not a valid PNG.");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function toProductTarget(row: JsonRecord): ProductTarget {
  const id = readString(row, ["id"]);
  const launchDate = readString(row, ["launch_date"]);
  const slug = readString(row, ["slug"], id);
  const name = readString(row, ["name"], slug);
  const url = readString(row, ["website_url", "url", "product_url"]);
  const fallbackImageUrl = selectProductMediaUrl(row.source_payload);
  const screenshotAttemptCount = readNumber(row, "screenshot_attempt_count");

  if (!id || !launchDate || !url) {
    throw new Error(
      `Product row is missing required fields: ${JSON.stringify({ id, launchDate, slug, url })}`
    );
  }

  return { fallbackImageUrl, id, launchDate, name, screenshotAttemptCount, slug, url };
}

function readNumber(row: JsonRecord, key: string) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readString(row: JsonRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function isProductHuntUrl(rawUrl: string) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname === "producthunt.com" || hostname.endsWith(".producthunt.com");
  } catch {
    return false;
  }
}

function createServiceClient() {
  return createClient(requireEnv("nextPublicSupabaseUrl"), requireEnv("supabaseServiceRoleKey"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function loadPuppeteer(): Promise<PuppeteerLike> {
  const moduleName = "puppeteer";

  try {
    const loaded = await import(moduleName);
    const candidate = (loaded.default ?? loaded) as Partial<PuppeteerLike>;

    if (typeof candidate.launch !== "function") {
      throw new Error("Puppeteer module does not expose launch().");
    }

    return candidate as PuppeteerLike;
  } catch (error) {
    throw new Error(
      `Failed to load puppeteer. Install it before running the screenshot job. ${toErrorMessage(error)}`
    );
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    all: false,
    bucket: process.env.SCREENSHOT_BUCKET ?? DEFAULT_BUCKET,
    json: true,
    limit: Number.parseInt(process.env.SCREENSHOT_BATCH_LIMIT ?? `${DEFAULT_LIMIT}`, 10),
    pathPrefix: process.env.SCREENSHOT_PATH_PREFIX ?? DEFAULT_PATH_PREFIX,
    preferMedia: false,
    refreshAfterDays: Number.parseInt(
      process.env.SCREENSHOT_REFRESH_AFTER_DAYS ?? `${DEFAULT_SCREENSHOT_REFRESH_AFTER_DAYS}`,
      10
    ),
    table: process.env.SUPABASE_PRODUCTS_TABLE ?? DEFAULT_TABLE,
    timeoutMs: Number.parseInt(process.env.SCREENSHOT_TIMEOUT_MS ?? `${DEFAULT_TIMEOUT_MS}`, 10)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    switch (current) {
      case "--id":
        options.id = readRequiredValue(argv, ++index, current);
        break;
      case "--slug":
        options.slug = readRequiredValue(argv, ++index, current);
        break;
      case "--date":
        options.date = readDate(readRequiredValue(argv, ++index, current), current);
        break;
      case "--limit":
        options.limit = parsePositiveInteger(readRequiredValue(argv, ++index, current), current);
        break;
      case "--timeout-ms":
        options.timeoutMs = parsePositiveInteger(readRequiredValue(argv, ++index, current), current);
        break;
      case "--bucket":
        options.bucket = readRequiredValue(argv, ++index, current);
        break;
      case "--table":
        options.table = readRequiredValue(argv, ++index, current);
        break;
      case "--path-prefix":
        options.pathPrefix = readRequiredValue(argv, ++index, current);
        break;
      case "--refresh-after-days":
        options.refreshAfterDays = parsePositiveInteger(
          readRequiredValue(argv, ++index, current),
          current
        );
        break;
      case "--all":
        options.all = true;
        break;
      case "--prefer-media":
        options.preferMedia = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--no-json":
        options.json = false;
        break;
      case "--help":
      case "-h":
        break;
      default:
        throw new Error(`Unknown argument: ${current}`);
    }
  }

  if (options.id && options.slug) {
    throw new Error("Use either --id or --slug for a single target, not both.");
  }

  return options;
}

function readRequiredValue(argv: string[], index: number, flag: string) {
  const value = argv[index];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function parsePositiveInteger(raw: string, flag: string) {
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run screenshot -- [options]

Options:
  --id <id>             Process one product by database id.
  --slug <slug>         Process one product by slug.
  --date <YYYY-MM-DD>   Process candidates and replace legacy non-WebP screenshots for one launch date.
  --limit <n>           Process the next pending batch from Supabase. Default: ${DEFAULT_LIMIT}
  --all                 Process every product currently missing screenshot metadata.
  --prefer-media        Prefer Product Hunt media over website navigation.
  --timeout-ms <ms>     Navigation and screenshot timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --bucket <name>       Supabase Storage bucket name. Default: ${DEFAULT_BUCKET}
  --table <name>        Supabase table name. Default: ${DEFAULT_TABLE}
  --path-prefix <path>  Storage path prefix. Default: ${DEFAULT_PATH_PREFIX}
  --refresh-after-days <n> Recapture screenshots older than n days. Default: ${DEFAULT_SCREENSHOT_REFRESH_AFTER_DAYS}
  --json                Print JSON summary output. Default.
  --no-json             Print plain logs only.
  --help                Show this message.

Environment:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SCREENSHOT_BUCKET
  SCREENSHOT_PATH_PREFIX
  SCREENSHOT_REFRESH_AFTER_DAYS
  SCREENSHOT_BATCH_LIMIT
  SCREENSHOT_TIMEOUT_MS
  SUPABASE_PRODUCTS_TABLE`);
}

function logJson(enabled: boolean, payload: JsonRecord) {
  if (enabled) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
}

function readDate(raw: string, flag: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00.000Z`))) {
    throw new Error(`${flag} must use YYYY-MM-DD.`);
  }

  return raw;
}

async function scrollLazyContent(page: BrowserPage) {
  for (let step = 0; step < 6; step += 1) {
    await page.evaluate(() => {
      window.scrollBy(0, Math.max(window.innerHeight, 900));
    });
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((resolve) => setTimeout(resolve, 500));
}

void main().catch((error) => {
  const message = toErrorMessage(error);
  console.error(`[screenshot] ${message}`);
  process.exitCode = 1;
});
