'use client';

import type { BatchState, ImportPhase } from '@/lib/types';

interface Props {
  phase: ImportPhase;
  batches: BatchState[];
  totalItems: number;
  importId: string | null;
  error?: string;
}

const PhaseLabel: Record<ImportPhase, string> = {
  idle: 'Idle',
  starting: 'Starting import...',
  sending: 'Sending items...',
  done_sent: 'Signalling done...',
  bootstrapping: 'Bootstrapping (see status panel)',
  complete: 'Import complete',
  error: 'Error',
};

const PhaseColor: Record<ImportPhase, string> = {
  idle: 'text-gray-500',
  starting: 'text-blue-600 dark:text-blue-400',
  sending: 'text-blue-600 dark:text-blue-400',
  done_sent: 'text-blue-600 dark:text-blue-400',
  bootstrapping: 'text-yellow-600 dark:text-yellow-400',
  complete: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
};

export default function BatchProgress({ phase, batches, totalItems, importId, error }: Props) {
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

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {batches.map((batch) => (
              <div
                key={batch.batchIndex}
                className="flex items-center justify-between text-sm px-3 py-2 rounded bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  <BatchIcon status={batch.status} />
                  <span className="text-gray-700 dark:text-gray-300">
                    Batch {batch.batchIndex + 1}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    ({batch.itemCount} items)
                  </span>
                </div>
                <StatusBadge status={batch.status} />
              </div>
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
