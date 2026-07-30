import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { requireEnv } from "../lib/env";
import { createPlaceholderPng } from "./lib/placeholder-png";

type JsonRecord = Record<string, unknown>;

type CliOptions = {
  all: boolean;
  bucket: string;
  id?: string;
  json: boolean;
  limit: number;
  pathPrefix: string;
  slug?: string;
  table: string;
  timeoutMs: number;
};

type ProductTarget = {
  id: string;
  name: string;
  slug: string;
  url: string;
};

type CaptureResult = {
  buffer: Buffer;
  captureStatus: "captured" | "fallback";
  failurePhase?: "navigation" | "screenshot" | "unknown";
  failureReason?: string;
};

type ProductRunResult = {
  captureStatus: CaptureResult["captureStatus"];
  failurePhase?: CaptureResult["failurePhase"];
  failureReason?: string;
  id: string;
  name: string;
  screenshotPath: string;
  screenshotUrl: string;
  slug: string;
  url: string;
};

type BrowserPage = {
  close(): Promise<void>;
  goto(url: string, options: { timeout: number; waitUntil: "networkidle2" | "domcontentloaded" }): Promise<unknown>;
  screenshot(options: { fullPage: true; type: "png"; timeout: number }): Promise<Uint8Array>;
  setViewport(viewport: { width: number; height: number }): Promise<void>;
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
    args: ["--no-sandbox"],
    userDataDir: mkdtempSync(join(tmpdir(), "visualph-chrome-"))
  });

  const results: ProductRunResult[] = [];

  try {
    for (const product of products) {
      const result = await processProduct({
        browser,
        options,
        product,
        supabase
      });

      results.push(result);
    }
  } finally {
    await browser.close();
  }

  const fallbackCount = results.filter((result) => result.captureStatus === "fallback").length;

  logJson(options.json, {
    fallbackCount,
    ok: true,
    processed: results.length,
    results
  });
}

async function processProduct(input: {
  browser: BrowserInstance;
  options: CliOptions;
  product: ProductTarget;
  supabase: SupabaseClient;
}) {
  const { browser, options, product, supabase } = input;
  const screenshotPath = buildScreenshotPath(product, options.pathPrefix);
  const capture = await captureProduct(browser, product.url, options.timeoutMs);
  const screenshotUrl = await uploadScreenshotBuffer({
    bucket: options.bucket,
    buffer: capture.buffer,
    path: screenshotPath,
    supabase
  });

  await updateScreenshotMetadata({
    capture,
    options,
    product,
    screenshotPath,
    screenshotUrl,
    supabase
  });

  return {
    captureStatus: capture.captureStatus,
    failurePhase: capture.failurePhase,
    failureReason: capture.failureReason,
    id: product.id,
    name: product.name,
    screenshotPath,
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
    .or("screenshot_path.is.null,screenshot_url.is.null")
    .order("launch_date", { ascending: false })
    .order("daily_rank", { ascending: true });

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
  if (isProductHuntUrl(url)) {
    return buildFallbackCapture(
      "navigation",
      new Error("Skipped Product Hunt URL; expected an external product website."),
      url
    );
  }

  const page = await browser.newPage();

  try {
    await page.setViewport(VIEWPORT);

    try {
      await page.goto(url, {
        timeout: timeoutMs,
        waitUntil: "networkidle2"
      });
    } catch (error) {
      return buildFallbackCapture("navigation", error, url);
    }

    try {
      const screenshot = await page.screenshot({
        fullPage: true,
        type: "png",
        timeout: timeoutMs
      });

      return {
        buffer: Buffer.from(screenshot),
        captureStatus: "captured"
      };
    } catch (error) {
      return buildFallbackCapture("screenshot", error, url);
    }
  } finally {
    await page.close();
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
    buffer: createPlaceholderPng(VIEWPORT),
    captureStatus: "fallback",
    failurePhase: phase ?? "unknown",
    failureReason: message
  };
}

async function uploadScreenshotBuffer(input: {
  bucket: string;
  buffer: Buffer;
  path: string;
  supabase: SupabaseClient;
}) {
  const { bucket, buffer, path, supabase } = input;
  const storage = supabase.storage.from(bucket);
  const { error } = await storage.upload(path, buffer, {
    contentType: "image/png",
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
  screenshotPath: string;
  screenshotUrl: string;
  supabase: SupabaseClient;
}) {
  const { capture, options, product, screenshotPath, screenshotUrl, supabase } = input;
  const now = new Date().toISOString();
  const updatePayload: JsonRecord = {
    screenshot_bucket: options.bucket,
    screenshot_path: screenshotPath,
    screenshot_url: screenshotUrl,
    screenshot_width: VIEWPORT.width,
    screenshot_height: VIEWPORT.height,
    screenshot_bytes: capture.buffer.byteLength,
    screenshot_mime_type: "image/png",
    screenshot_captured_at: now,
    updated_at: now
  };

  const { error } = await supabase
    .from(options.table)
    .update(updatePayload)
    .eq("id", product.id);

  if (error) {
    throw new Error(`Failed to update screenshot metadata for ${product.slug}: ${error.message}`);
  }

  if (capture.captureStatus === "fallback") {
    console.warn(`[screenshot] stored fallback image for ${product.slug} at ${screenshotPath}`);
  } else {
    console.log(`[screenshot] captured ${product.slug} -> ${screenshotPath}`);
  }
}

function buildScreenshotPath(product: ProductTarget, pathPrefix: string) {
  const safeSlug = sanitizePathPart(product.slug || product.id);
  return `${pathPrefix}/${safeSlug}/latest.png`;
}

function toProductTarget(row: JsonRecord): ProductTarget {
  const id = readString(row, ["id"]);
  const slug = readString(row, ["slug"], id);
  const name = readString(row, ["name"], slug);
  const url = readString(row, ["website_url", "url", "product_url"]);

  if (!id || !url) {
    throw new Error(`Product row is missing required fields: ${JSON.stringify({ id, slug, url })}`);
  }

  return { id, name, slug, url };
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

function sanitizePathPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "product";
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
      case "--all":
        options.all = true;
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
  --limit <n>           Process the next pending batch from Supabase. Default: ${DEFAULT_LIMIT}
  --all                 Process every product currently missing screenshot metadata.
  --timeout-ms <ms>     Navigation and screenshot timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --bucket <name>       Supabase Storage bucket name. Default: ${DEFAULT_BUCKET}
  --table <name>        Supabase table name. Default: ${DEFAULT_TABLE}
  --path-prefix <path>  Storage path prefix. Default: ${DEFAULT_PATH_PREFIX}
  --json                Print JSON summary output. Default.
  --no-json             Print plain logs only.
  --help                Show this message.

Environment:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SCREENSHOT_BUCKET
  SCREENSHOT_PATH_PREFIX
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

void main().catch((error) => {
  const message = toErrorMessage(error);
  console.error(`[screenshot] ${message}`);
  process.exitCode = 1;
});

