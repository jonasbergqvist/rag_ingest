'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getImportStatus } from '@/lib/ragApi';
import type { ImportStatus, RagCredentials } from '@/lib/types';

interface Props {
  importId: string | null;
  credentials: RagCredentials;
  /**
   * Total number of items in this import. Used to guard against a stale
   * "ready" bootstrap state from a previous import on the same tenant:
   * we only treat bootstrap===ready as terminal once enqueued >= expectedItems.
   */
  expectedItems: number;
  /** Whether items are still being sent — polling waits until this is false */
  active: boolean;
  /** Called when bootstrap reaches a terminal state */
  onBootstrapComplete?: (status: 'ready' | 'error', errorMsg?: string) => void;
}

const POLL_INTERVAL_MS = 10_000;

export default function StatusPanel({ importId, credentials, expectedItems, active, onBootstrapComplete }: Props) {
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000);
  const [isDone, setIsDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep latest values accessible inside the setInterval closure without re-creating it
  const expectedItemsRef = useRef(expectedItems);
  const onCompleteRef = useRef(onBootstrapComplete);
  const prevActiveRef = useRef(active);

  useEffect(() => {
    expectedItemsRef.current = expectedItems;
  }, [expectedItems]);

  useEffect(() => {
    onCompleteRef.current = onBootstrapComplete;
  }, [onBootstrapComplete]);

  const stopPolling = useCallback(() => {
    clearInterval(timerRef.current!);
    clearInterval(countdownRef.current!);
    timerRef.current = null;
    countdownRef.current = null;
  }, []);

  const poll = useCallback(async () => {
    if (!importId || !credentials.appKey || !credentials.secret) return;

    try {
      const result = await getImportStatus(credentials, importId);
      setStatus(result);
      setLastUpdated(new Date());
      setPollError(null);

      const expected = expectedItemsRef.current;

      if (result.bootstrap === 'ready' && result.counts.enqueued >= expected) {
        // Terminal success — all items accounted for and bootstrap finished
        setIsDone(true);
        stopPolling();
        onCompleteRef.current?.('ready');
      } else if (result.bootstrap === 'error') {
        setIsDone(true);
        stopPolling();
        onCompleteRef.current?.('error', result.bootstrapError ?? 'Unknown bootstrap error');
      }
      // If bootstrap===ready but enqueued < expected, the items are still being
      // sent — keep polling until they catch up.
    } catch (e) {
      setPollError(e instanceof Error ? e.message : 'Failed to fetch status');
    }

    setCountdown(POLL_INTERVAL_MS / 1000);
  }, [importId, credentials, stopPolling]);

  // Start polling whenever importId changes (new import session).
  // StatusPanel is keyed by importId in the parent so this effect starts fresh
  // for every import session.
  useEffect(() => {
    if (!importId) return;

    // Immediate first poll
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll();

    // Poll every 10s
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // Countdown ticker (decrements each second, reset to 10 after each poll)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    return () => stopPolling();
  }, [importId, poll, stopPolling]);

  // When active flips to false (all batches sent + /done called), trigger an
  // immediate poll so the UI doesn't wait up to 10s to reflect reality.
  useEffect(() => {
    if (prevActiveRef.current && !active && importId && !isDone) {
      poll();
    }
    prevActiveRef.current = active;
  }, [active, importId, isDone, poll]);

  const bootstrapStatus = status?.bootstrap;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Live Status
        </h3>
        {importId && !isDone && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Next poll in {countdown}s
          </span>
        )}
        {isDone && (
          <span className="text-xs text-green-500">Polling complete</span>
        )}
      </div>

      {!importId ? (
        <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          Status will appear here once an import is started.
        </div>
      ) : (
        <>
          {pollError && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded px-3 py-2">
              Poll error: {pollError}
            </div>
          )}

          {status ? (
            <div className="space-y-3">
              {/* Bootstrap status banner — suppress stale "ready" until items are enqueued */}
              <BootstrapBanner
                bootstrap={bootstrapStatus ?? null}
                bootstrapError={status.bootstrapError}
                enqueued={status.counts.enqueued}
                expectedItems={expectedItems}
              />

              {/* Import status row */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <StatusRow label="Import Status" value={status.status} />
                <StatusRow label="Bootstrap" value={status.bootstrap ?? 'not started'} />
              </div>

              {/* Counts */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Item Counts
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <CountRow label="Enqueued" value={status.counts.enqueued} color="text-blue-600 dark:text-blue-400" />
                  <CountRow label="Processed" value={status.counts.processed} color="text-yellow-600 dark:text-yellow-400" />
                  <CountRow label="Succeeded" value={status.counts.succeeded} color="text-green-600 dark:text-green-400" />
                  <CountRow label="Failed" value={status.counts.failed} color="text-red-600 dark:text-red-400" />
                </div>

                {/* Success progress bar */}
                {status.counts.enqueued > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Processing</span>
                      <span>{Math.round((status.counts.succeeded / status.counts.enqueued) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${(status.counts.succeeded / status.counts.enqueued) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {lastUpdated && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Fetching status...
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BootstrapBanner({
  bootstrap,
  bootstrapError,
  enqueued,
  expectedItems,
}: {
  bootstrap: string | null;
  bootstrapError: string | null;
  enqueued: number;
  expectedItems: number;
}) {
  // If bootstrap is already "ready" but items haven't been enqueued yet,
  // this is a stale result from a prior import on this tenant — show waiting.
  const isStaleReady = bootstrap === 'ready' && expectedItems > 0 && enqueued < expectedItems;

  if (bootstrap === 'ready' && !isStaleReady) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2">
        <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm text-green-700 dark:text-green-300 font-medium">
          Bootstrap complete — content is ready in RAG Graph.
        </p>
      </div>
    );
  }
  if (isStaleReady) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-3 py-2">
        <svg className="w-4 h-4 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Waiting for items to be enqueued&hellip;
        </p>
      </div>
    );
  }
  if (bootstrap === 'error') {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
        <p className="text-sm text-red-700 dark:text-red-300 font-medium">Bootstrap failed</p>
        {bootstrapError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{bootstrapError}</p>
        )}
      </div>
    );
  }
  if (bootstrap === 'bootstrapping' || bootstrap != null) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-3 py-2">
        <svg className="w-4 h-4 text-yellow-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          Bootstrap in progress&hellip;
        </p>
      </div>
    );
  }
  return null;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{value}</p>
    </div>
  );
}

function CountRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-xs font-semibold ${color}`}>{value}</span>
    </div>
  );
}
