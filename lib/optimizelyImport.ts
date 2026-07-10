import type { CrawledItem } from "./types";

export const OPTIMIZELY_CRAWL_BASE = "/optimizely-crawl";

export interface CrawlManifest {
  source: string;
  count: number;
  files: string[];
}

export async function fetchOptimizelyManifest(): Promise<CrawlManifest> {
  const url = `${OPTIMIZELY_CRAWL_BASE}/manifest.json`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load crawled content manifest: ${response.status}`);
  }
  return response.json() as Promise<CrawlManifest>;
}

export async function fetchOptimizelyItem(fileName: string): Promise<CrawledItem> {
  const url = `${OPTIMIZELY_CRAWL_BASE}/${encodeURIComponent(fileName)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${fileName}: ${response.status}`);
  }
  return response.json() as Promise<CrawledItem>;
}

export async function loadOptimizelyBatch(
  files: string[],
  batchIndex: number,
  batchSize: number
): Promise<CrawledItem[]> {
  const start = batchIndex * batchSize;
  const slice = files.slice(start, start + batchSize);
  const items = await Promise.all(slice.map((file) => fetchOptimizelyItem(file)));
  return items;
}
