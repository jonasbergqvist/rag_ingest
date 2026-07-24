import type {
  RagCredentials,
  RagQueryResponse,
  StartImportResponse,
  SendItemsResponse,
  DoneResponse,
  ImportStatus,
  CrawledItem,
  RagBootstrapResponse,
  TenantStatusResponse,
} from "./types";

function buildAuthHeader(appKey: string, secret: string): string {
  const encoded = btoa(`${appKey}:${secret}`);
  return `Basic ${encoded}`;
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

export class RagFetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'RagFetchError';
    this.status = status;
  }
}

function getRetryDelay(attempt: number, response?: Response): number {
  const retryAfter = response?.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  const jitter = Math.random() * 500;
  return BASE_DELAY_MS * Math.pow(2, attempt) + jitter;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof RagFetchError) {
    return RETRYABLE_STATUS_CODES.has(error.status);
  }
  return error instanceof TypeError;
}

async function ragFetch<T>(
  url: string,
  credentials: RagCredentials,
  options: RequestInit = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: buildAuthHeader(credentials.appKey, credentials.secret),
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          errorMessage = body.message ?? body.error ?? errorMessage;
        } catch {
          // ignore parse errors
        }
        const error = new RagFetchError(errorMessage, response.status);

        if (isRetryable(error) && attempt < MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, getRetryDelay(attempt, response)));
          lastError = error;
          continue;
        }
        throw error;
      }

      return response.json() as Promise<T>;
    } catch (e) {
      lastError = e;
      if (e instanceof RagFetchError) throw e;

      if (isRetryable(e) && attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, getRetryDelay(attempt)));
        continue;
      }
      throw e;
    }
  }

  throw lastError;
}

/**
 * Query the RAG graph with a natural-language question.
 */
export async function queryRag(
  credentials: RagCredentials,
  query: string
): Promise<RagQueryResponse> {
  const url = `${credentials.baseUrl.replace(/\/$/, "")}/rag/query`;
  return ragFetch<RagQueryResponse>(url, credentials, {
    method: "POST",
    body: JSON.stringify({ question: query }),
  });
}

/**
 * Step 1: GET /rag/import
 * Opens a new import session and returns an importId.
 */
export async function startImport(
  credentials: RagCredentials
): Promise<StartImportResponse> {
  const url = `${credentials.baseUrl.replace(/\/$/, "")}/rag/import`;
  return ragFetch<StartImportResponse>(url, credentials, { method: "GET" });
}

/**
 * Step 2: POST /rag/import/items
 * Sends a batch of crawled items.
 */
export async function sendItems(
  credentials: RagCredentials,
  importId: string,
  items: CrawledItem[]
): Promise<SendItemsResponse> {
  const url = `${credentials.baseUrl.replace(/\/$/, "")}/rag/import/items`;
  return ragFetch<SendItemsResponse>(url, credentials, {
    method: "POST",
    body: JSON.stringify({ importId, items }),
  });
}

/**
 * Step 3: GET /rag/import/:importId/done
 * Signals all items have been sent; kicks off bootstrap.
 */
export async function finishImport(
  credentials: RagCredentials,
  importId: string
): Promise<DoneResponse> {
  const url = `${credentials.baseUrl.replace(/\/$/, "")}/rag/import/${importId}/done`;
  return ragFetch<DoneResponse>(url, credentials, { method: "GET" });
}

/**
 * Step 4: GET /rag/import/:importId/status
 * Polls the status of the import and bootstrap.
 */
export async function getImportStatus(
  credentials: RagCredentials,
  importId: string
): Promise<ImportStatus> {
  const url = `${credentials.baseUrl.replace(/\/$/, "")}/rag/import/${importId}/status`;
  return ragFetch<ImportStatus>(url, credentials, { method: "GET" });
}

/**
 * POST /rag/bootstrap
 * Triggers a bootstrap of the RAG graph schema for the authenticated tenant.
 * An empty JSON object is accepted as a body; tenant identity comes from auth.
 */
export async function bootstrapRag(
  credentials: RagCredentials
): Promise<RagBootstrapResponse> {
  const url = `${credentials.baseUrl.replace(/\/$/, "")}/rag/bootstrap`;
  return ragFetch<RagBootstrapResponse>(url, credentials, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/**
 * GET /rag/tenant/status
 * Polls the authenticated tenant's bootstrap/status state. The auth
 * credentials resolve the tenant server-side, so no tenant id is needed.
 */
export async function getTenantStatus(
  credentials: RagCredentials
): Promise<TenantStatusResponse> {
  const url = `${credentials.baseUrl.replace(/\/$/, "")}/rag/tenant/status`;
  return ragFetch<TenantStatusResponse>(url, credentials, { method: "GET" });
}

/**
 * Split an array into chunks of the given size.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const MAX_BATCH_BYTES = 900_000; // ~900KB, conservative margin under 1 MiB server limit
const ENVELOPE_OVERHEAD = 100; // {"importId":"...","items":[]} wrapper

/**
 * Group items into batches that fit within the server's body size limit.
 * Each item is measured by its JSON-serialized length. Items that individually
 * exceed the limit are sent as solo batches (the server may still reject them,
 * but we don't compound the problem by grouping them).
 */
export function chunkItemsBySize(items: CrawledItem[]): CrawledItem[][] {
  const chunks: CrawledItem[][] = [];
  let current: CrawledItem[] = [];
  let currentSize = ENVELOPE_OVERHEAD;

  for (const item of items) {
    const itemSize = JSON.stringify(item).length + 1; // +1 for array comma
    if (current.length > 0 && currentSize + itemSize > MAX_BATCH_BYTES) {
      chunks.push(current);
      current = [];
      currentSize = ENVELOPE_OVERHEAD;
    }
    current.push(item);
    currentSize += itemSize;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}
