'use client';

import { useState } from 'react';
import type { BatchState, ImportPhase } from '@/lib/types';

interface Props {
  phase: ImportPhase;
  batches: BatchState[];
  totalItems: number;
  importId: string | null;
  error?: string;
  onRetryFailed?: () => void;
  onBootstrapAnyway?: () => void;
  onStartOver?: () => void;
}

const PhaseLabel: Record<ImportPhase, string> = {
  idle: 'Idle',
  starting: 'Starting import...',
  sending: 'Sending items...',
  awaiting_decision: 'Action required',
  done_sent: 'Signalling done...',
  bootstrapping: 'Bootstrapping (see status panel)',
  complete: 'Import complete',
  error: 'Error',
};

const PhaseColor: Record<ImportPhase, string> = {
  idle: 'text-gray-500',
  starting: 'text-blue-600 dark:text-blue-400',
  sending: 'text-blue-600 dark:text-blue-400',
  awaiting_decision: 'text-yellow-600 dark:text-yellow-400',
  done_sent: 'text-blue-600 dark:text-blue-400',
  bootstrapping: 'text-yellow-600 dark:text-yellow-400',
  complete: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
};

export default function BatchProgress({ phase, batches, totalItems, importId, error, onRetryFailed, onBootstrapAnyway, onStartOver }: Props) {
  const sentItems = batches
    .filter((b) => b.status === 'done')
    .reduce((sum, b) => sum + b.itemCount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Import Progress
        </h3>
        <span className={`text-sm font-medium ${PhaseColor[phase]}`}>
          {PhaseLabel[phase]}
        </span>
      </div>

      {importId && (
        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 break-all">
          Import ID: {importId}
        </div>
      )}

      {batches.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{batches.length} batches &mdash; {totalItems} total items</span>
            <span>{sentItems} / {totalItems} sent</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${totalItems > 0 ? (sentItems / totalItems) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {batches.map((batch) => (
              <BatchRow key={batch.batchIndex} batch={batch} />
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {phase === 'complete' && (
        <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
          <p className="text-sm text-green-700 dark:text-green-300">
            All {totalItems} items sent successfully. Bootstrap is underway — monitor status on the right.
          </p>
        </div>
      )}

      {phase === 'awaiting_decision' && (() => {
        const failed = batches.filter((b) => b.status === 'error');
        const succeeded = batches.filter((b) => b.status === 'done');
        return (
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {succeeded.length} of {batches.length} batches succeeded. {failed.length} failed.
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                {succeeded.reduce((s, b) => s + b.itemCount, 0)} items sent successfully.
                {' '}{failed.reduce((s, b) => s + b.itemCount, 0)} items need attention.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onRetryFailed && (
                <button
                  onClick={onRetryFailed}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Retry Failed ({failed.length})
                </button>
              )}
              {onBootstrapAnyway && succeeded.length > 0 && (
                <button
                  onClick={onBootstrapAnyway}
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
                >
                  Bootstrap Anyway ({succeeded.reduce((s, b) => s + b.itemCount, 0)} items)
                </button>
              )}
              {onStartOver && (
                <button
                  onClick={onStartOver}
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Start Over
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function BatchIcon({ status }: { status: BatchState['status'] }) {
  switch (status) {
    case 'done':
      return (
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'sending':
      return (
        <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
  }
}

function StatusBadge({ status }: { status: BatchState['status'] }) {
  const map = {
    pending: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    sending: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    done: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status]}`}>
      {status}
    </span>
  );
}

function BatchRow({ batch }: { batch: BatchState }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = batch.status === 'error' && (batch.error || batch.itemUrls);

  return (
    <div className="rounded bg-gray-50 dark:bg-gray-800">
      <div
        className={[
          'flex items-center justify-between text-sm px-3 py-2',
          hasDetail ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : '',
        ].join(' ')}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <BatchIcon status={batch.status} />
          <span className="text-gray-700 dark:text-gray-300">
            Batch {batch.batchIndex + 1}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-xs">
            ({batch.itemCount} items)
          </span>
          {hasDetail && (
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
        <StatusBadge status={batch.status} />
      </div>
      {expanded && hasDetail && (
        <div className="px-3 pb-2 space-y-1">
          {batch.error && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {batch.errorStatus ? `${friendlyStatus(batch.errorStatus)}: ` : ''}
              {batch.error}
            </p>
          )}
          {batch.itemUrls && batch.itemUrls.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p className="font-medium">Items in this batch:</p>
              <ul className="mt-0.5 space-y-0.5 font-mono">
                {batch.itemUrls.map((url, i) => (
                  <li key={i} className="truncate">{url}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function friendlyStatus(status: number): string {
  const map: Record<number, string> = {
    408: 'Request Timeout (408)',
    413: 'Payload Too Large (413)',
    429: 'Rate Limited (429)',
    500: 'Server Error (500)',
    502: 'Bad Gateway (502)',
    503: 'Service Unavailable (503)',
    504: 'Gateway Timeout (504)',
  };
  return map[status] ?? `HTTP ${status}`;
}
