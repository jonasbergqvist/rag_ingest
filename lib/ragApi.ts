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

async function ragFetch<T>(
  url: string,
  credentials: RagCredentials,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: buildAuthHeader(credentials.appKey, credentials.secret),
      "Content-Type": "application/json",
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
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
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
