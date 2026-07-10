'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DragDropZone from '@/components/DragDropZone';
import BatchProgress from '@/components/BatchProgress';
import StatusPanel from '@/components/StatusPanel';
import CurlInstructions from '@/components/CurlInstructions';
import { useRagConfig } from '@/lib/useRagConfig';
import {
  startImport,
  sendItems,
  finishImport,
  chunkArray,
  bootstrapRag,
  getTenantStatus,
} from '@/lib/ragApi';
import {
  fetchOptimizelyManifest,
  loadOptimizelyBatch,
} from '@/lib/optimizelyImport';
import type {
  BatchState,
  CrawledItem,
  ImportPhase,
  ImportSession,
  RagBootstrapResponse,
  TenantStatusResponse,
} from '@/lib/types';
import type { CrawlManifest } from '@/lib/optimizelyImport';

const BATCH_SIZE = 1;

const initialSession: ImportSession = {
  phase: 'idle',
  importId: null,
  batches: [],
  totalItems: 0,
};

type ContentSource = 'none' | 'files' | 'optimizely';

function mask(value: string) {
  if (value.length <= 4) return '••••';
  return `${value.slice(0, 2)}•••${value.slice(-2)}`;
}

export default function IngestPage() {
  const { credentials } = useRagConfig();
  const [items, setItems] = useState<CrawledItem[]>([]);
  const [session, setSession] = useState<ImportSession>(initialSession);
  const [source, setSource] = useState<ContentSource>('none');
  const [manifest, setManifest] = useState<CrawlManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);
  const [bootstrapState, setBootstrapState] = useState<{
    loading: boolean;
    result: RagBootstrapResponse | null;
    error: string | null;
  }>({ loading: false, result: null, error: null });
  const [tenantStatus, setTenantStatus] = useState<TenantStatusResponse | null>(null);
  const [tenantStatusError, setTenantStatusError] = useState<string | null>(null);
  const [isTenantStatusPolling, setIsTenantStatusPolling] = useState(false);

  const isConfigured =
    credentials.baseUrl.trim() !== '' &&
    credentials.appKey.trim() !== '' &&
    credentials.secret.trim() !== '';

  const isImporting = [
    'starting',
    'sending',
    'done_sent',
    'bootstrapping',
  ].includes(session.phase);

  const hasContent =
    (source === 'files' && items.length > 0) ||
    (source === 'optimizely' && !!manifest);

  const canStart = hasContent && isConfigured && !isImporting;
  const canBootstrap = isConfigured && !isImporting && !bootstrapState.loading;

  const setPhase = (phase: ImportPhase) =>
    setSession((s) => ({ ...s, phase }));

  const handleItemsLoaded = useCallback((loaded: CrawledItem[]) => {
    setItems(loaded);
    setSource(loaded.length > 0 ? 'files' : 'none');
    setManifest(null);
    setManifestError(null);
  }, []);

  const handleImportOptimizely = useCallback(async () => {
    setIsLoadingManifest(true);
    setManifestError(null);
    try {
      const m = await fetchOptimizelyManifest();
      setManifest(m);
      setSource('optimizely');
      setItems([]);
    } catch (e) {
      setManifestError(
        e instanceof Error ? e.message : String(e)
      );
      setManifest(null);
      setSource('none');
    } finally {
      setIsLoadingManifest(false);
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!canStart) return;

    let totalItems = 0;
    if (source === 'files') {
      totalItems = items.length;
    } else if (source === 'optimizely' && manifest) {
      totalItems = manifest.count;
    } else {
      return;
    }

    const batchCount = Math.ceil(totalItems / BATCH_SIZE);
    const batchStates: BatchState[] = Array.from(
      { length: batchCount },
      (_, i) => ({
        batchIndex: i,
        itemCount: Math.min(BATCH_SIZE, totalItems - i * BATCH_SIZE),
        status: 'pending',
      })
    );

    setSession({
      phase: 'starting',
      importId: null,
      batches: batchStates,
      totalItems,
    });

    let importId: string;

    try {
      const result = await startImport(credentials);
      importId = result.importId;
      setSession((s) => ({ ...s, importId, phase: 'sending' }));
    } catch (e) {
      setSession((s) => ({
        ...s,
        phase: 'error',
        error: `Failed to start import: ${e instanceof Error ? e.message : String(e)}`,
      }));
      return;
    }

    const fileBatches =
      source === 'files' ? chunkArray(items, BATCH_SIZE) : null;

    for (let i = 0; i < batchCount; i++) {
      setSession((s) => {
        const updated = [...s.batches];
        updated[i] = { ...updated[i], status: 'sending' };
        return { ...s, batches: updated };
      });

      try {
        let batchItems: CrawledItem[];
        if (source === 'files' && fileBatches) {
          batchItems = fileBatches[i];
        } else if (source === 'optimizely' && manifest) {
          batchItems = await loadOptimizelyBatch(
            manifest.files,
            i,
            BATCH_SIZE
          );
        } else {
          batchItems = [];
        }

        await sendItems(credentials, importId, batchItems);
        setSession((s) => {
          const updated = [...s.batches];
          updated[i] = { ...updated[i], status: 'done' };
          return { ...s, batches: updated };
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        setSession((s) => {
          const updated = [...s.batches];
          updated[i] = { ...updated[i], status: 'error', error: errMsg };
          return { ...s, batches: updated };
        });
      }
    }

    setPhase('done_sent');
    try {
      await finishImport(credentials, importId);
    } catch (e) {
      setSession((s) => ({
        ...s,
        phase: 'error',
        error: `Failed to signal done: ${e instanceof Error ? e.message : String(e)}`,
      }));
      return;
    }

    // All items have been acknowledged by the server. Explicitly start the
    // schema bootstrap; the status panel will poll until it completes.
    setPhase('bootstrapping');
    try {
      const result = await bootstrapRag(credentials);
      setBootstrapState({ loading: false, result, error: null });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setBootstrapState({ loading: false, result: null, error: errMsg });
    }
  }, [canStart, credentials, items, manifest, source]);

  const handleBootstrapComplete = useCallback(
    (status: 'ready' | 'error', errorMsg?: string) => {
      if (status === 'ready') {
        setPhase('complete');
      } else {
        setSession((s) => ({
          ...s,
          phase: 'error',
          error: `Bootstrap failed: ${errorMsg ?? 'Unknown error'}`,
        }));
      }
    },
    []
  );

  const handleReset = () => {
    setItems([]);
    setSession(initialSession);
    setSource('none');
    setManifest(null);
    setManifestError(null);
    setBootstrapState({ loading: false, result: null, error: null });
    setTenantStatus(null);
    setTenantStatusError(null);
  };

  const handleBootstrap = useCallback(async () => {
    if (!canBootstrap) return;
    setBootstrapState({ loading: true, result: null, error: null });
    setTenantStatus(null);
    setTenantStatusError(null);
    try {
      const result = await bootstrapRag(credentials);
      setBootstrapState({ loading: false, result, error: null });
    } catch (e) {
      setBootstrapState({
        loading: false,
        result: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, [canBootstrap, credentials]);

  // Poll the authenticated tenant's bootstrap status after a manual bootstrap.
  useEffect(() => {
    if (!bootstrapState.result) {
      setIsTenantStatusPolling(false);
      return;
    }
    if (!isConfigured) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const isTerminal = (s: TenantStatusResponse) =>
      s.status === 'ready' ||
      s.status === 'error' ||
      // Some backends keep reporting 'bootstrapping' while also setting
      // lastBootstrapAt once the run has finished. Treat that as terminal.
      (s.status === 'bootstrapping' && !!s.lastBootstrapAt);

    async function poll() {
      try {
        const result = await getTenantStatus(credentials);
        if (cancelled) return;
        setTenantStatus(result);
        setTenantStatusError(null);
      if (isTerminal(result) && intervalId) {
        clearInterval(intervalId);
        setIsTenantStatusPolling(false);
      }
      } catch (e) {
        if (cancelled) return;
        setTenantStatusError(e instanceof Error ? e.message : String(e));
      }
    }

    setIsTenantStatusPolling(true);
    poll();
    intervalId = setInterval(poll, 10_000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      setIsTenantStatusPolling(false);
    };
  }, [bootstrapState.result, credentials, isConfigured]);

  const missingCredentials: string[] = [];
  if (!credentials.baseUrl) missingCredentials.push('Base URL');
  if (!credentials.appKey) missingCredentials.push('App Key');
  if (!credentials.secret) missingCredentials.push('Secret');

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Ingest content
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Import crawled JSON content into your RAG graph
            </p>
          </div>

          {(session.phase === 'complete' || session.phase === 'error') && (
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <aside className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm lg:sticky lg:top-6 overflow-y-auto max-h-[calc(100vh-120px)]">
          <CurlInstructions baseUrl={credentials.baseUrl} appKey={credentials.appKey} />
        </aside>

        <section className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              1. Add content
            </h2>
            <DragDropZone
              onItemsLoaded={handleItemsLoaded}
              disabled={isImporting}
            />

            <div className="relative my-4 flex items-center">
              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
              <span className="px-3 text-xs text-gray-400 dark:text-gray-500 uppercase">
                or
              </span>
              <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
            </div>

            <button
              onClick={handleImportOptimizely}
              disabled={isImporting || isLoadingManifest}
              className={[
                'w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all border',
                source === 'optimizely'
                  ? 'border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
                (isImporting || isLoadingManifest) ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {isLoadingManifest ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading optimizely.com content…
                </span>
              ) : source === 'optimizely' && manifest ? (
                `Import optimizely.com selected (${manifest.count} pages)`
              ) : (
                'Import optimizely.com'
              )}
            </button>

            {manifestError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {manifestError}
              </p>
            )}

            {source === 'files' && items.length > 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {items.length} items across {Math.ceil(items.length / BATCH_SIZE)} batches of {BATCH_SIZE}
              </p>
            )}
            {source === 'optimizely' && manifest && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {manifest.count} items from optimizely.com across {Math.ceil(manifest.count / BATCH_SIZE)} batches of {BATCH_SIZE}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Connection
              </h2>
              <Link
                href="/connection"
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Manage
              </Link>
            </div>

            {isConfigured ? (
              <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Base URL:</span>{' '}
                  {credentials.baseUrl}
                </p>
                <p>
                  <span className="text-gray-500 dark:text-gray-400">App Key:</span>{' '}
                  {mask(credentials.appKey)}
                </p>
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Secret:</span>{' '}
                  {mask(credentials.secret)}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Connection is incomplete. Configure the following on the{' '}
                  <Link href="/connection" className="underline">
                    Connection
                  </Link>{' '}
                  page:
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
                  {missingCredentials.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              2. Send to RAG Graph
            </h2>

            <button
              onClick={handleStart}
              disabled={!canStart}
              className={[
                'w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all',
                canStart
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-[0.98]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed',
              ].join(' ')}
            >
              {isImporting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importing…
                </span>
              ) : (
                'Start Sending to RAG Graph'
              )}
            </button>

            {!canStart && !isImporting && (
              <ul className="mt-3 space-y-1">
                {!hasContent && (
                  <li className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />
                    Drop JSON files above or import optimizely.com
                  </li>
                )}
                {!credentials.baseUrl && (
                  <li className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />
                    Enter a Base URL
                  </li>
                )}
                {!credentials.appKey && (
                  <li className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />
                    Enter an App Key
                  </li>
                )}
                {!credentials.secret && (
                  <li className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />
                    Enter a Secret
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              3. Bootstrap schema
            </h2>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Manually trigger a bootstrap to introspect the content-type schema.
              The endpoint is rate-limited to one call per hour per tenant.
            </p>

            <button
              onClick={handleBootstrap}
              disabled={!canBootstrap}
              className={[
                'w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all',
                canBootstrap
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md active:scale-[0.98]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed',
              ].join(' ')}
            >
              {bootstrapState.loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Bootstrapping…
                </span>
              ) : (
                'Bootstrap RAG Graph'
              )}
            </button>

            {bootstrapState.result && (
              <div className="mt-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Bootstrap started
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Workflow ID: {bootstrapState.result.workflowId}
                </p>
              </div>
            )}

            {bootstrapState.result && (
              <div className="mt-3 rounded-md bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 px-3 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Live tenant status
                  </p>
                  {isTenantStatusPolling &&
                    tenantStatus?.status !== 'ready' &&
                    tenantStatus?.status !== 'error' && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Polling
                      </span>
                    )}
                </div>

                {tenantStatusError && !tenantStatus && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {tenantStatusError}
                  </p>
                )}

                {!tenantStatus && !tenantStatusError && isTenantStatusPolling && (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Fetching bootstrap status…
                  </p>
                )}

                {tenantStatus && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {tenantStatus.status === 'ready' ||
                      (tenantStatus.status === 'bootstrapping' &&
                        !!tenantStatus.lastBootstrapAt) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Ready
                        </span>
                      ) : tenantStatus.status === 'error' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Error
                        </span>
                      ) : tenantStatus.status === 'bootstrapping' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Bootstrapping
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                          {tenantStatus.status}
                        </span>
                      )}
                    </div>

                    {tenantStatus.status === 'error' && tenantStatus.errorMessage && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {tenantStatus.errorMessage}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div>
                        Content types:{' '}
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {tenantStatus.contentTypeCount}
                        </span>
                      </div>
                      {tenantStatus.lastBootstrapAt && (
                        <div>
                          Finished:{' '}
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {new Date(tenantStatus.lastBootstrapAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {bootstrapState.error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {bootstrapState.error}
              </p>
            )}
          </div>

          {session.phase !== 'idle' && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <BatchProgress
                phase={session.phase}
                batches={session.batches}
                totalItems={session.totalItems}
                importId={session.importId}
                error={session.error}
              />
            </div>
          )}
        </section>

        <aside className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm lg:sticky lg:top-6">
          <StatusPanel
            key={session.importId ?? 'idle'}
            importId={session.importId}
            credentials={credentials}
            expectedItems={session.totalItems}
            active={isImporting}
            onBootstrapComplete={handleBootstrapComplete}
          />
        </aside>
      </main>
    </div>
  );
}
