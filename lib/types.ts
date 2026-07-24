// CrawledItem shape as expected by POST /rag/import/items
export interface CrawledItem {
  SourceUrl: string;
  PageTitle: string;
  BodyHtml: string;
  BodyMarkdown: string;
  HttpStatus: number;
  ContentHash: string;
  CrawledAt: string;
  RunId: string;
}

// Auth credentials
export interface RagCredentials {
  baseUrl: string;
  appKey: string;
  secret: string;
}

// POST /rag/query response
export interface RagQueryResponse {
  answer: string;
  sources?: Array<{ title: string; url?: string; contentType?: string; score?: number }>;
  queryExecuted?: string;
  variablesUsed?: Record<string, unknown>;
}

// GET /rag/import response
export interface StartImportResponse {
  importId: string;
}

// POST /rag/import/items response
export interface SendItemsResponse {
  accepted: number;
}

// GET /rag/import/:importId/done response
export interface DoneResponse {
  status: string;
}

// POST /rag/bootstrap response
export interface RagBootstrapResponse {
  workflowId: string;
  status: string;
  message: string;
}

// GET /rag/import/:importId/status response
export interface ImportStatus {
  importId: string;
  status: "receiving" | "sending_complete" | "bootstrapping" | "ready" | "error";
  counts: {
    enqueued: number;
    processed: number;
    succeeded: number;
    failed: number;
  };
  bootstrap: "ready" | "error" | null | string;
  bootstrapError: string | null;
}

// GET /rag/tenant/status response
export interface TenantStatusResponse {
  tenantId: string;
  status: string;
  contentTypeCount: number;
  lastBootstrapAt: string | null;
  lastRefreshAt: string | null;
  schemaHash: string | null;
  errorMessage: string | null;
}

// Per-batch tracking state
export interface BatchState {
  batchIndex: number;
  itemCount: number;
  status: 'pending' | 'sending' | 'done' | 'error';
  error?: string;
  errorStatus?: number;
  itemUrls?: string[];
}

// Overall import session state
export type ImportPhase =
  | 'idle'
  | 'starting'
  | 'sending'
  | 'awaiting_decision'
  | 'done_sent'
  | 'bootstrapping'
  | 'complete'
  | 'error';

export interface ImportSession {
  phase: ImportPhase;
  importId: string | null;
  batches: BatchState[];
  totalItems: number;
  error?: string;
}
