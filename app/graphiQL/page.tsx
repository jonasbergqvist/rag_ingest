'use client';

import Link from 'next/link';
import { useRagConfig } from '@/lib/useRagConfig';

const GRAPHIQL_ORIGIN = 'https://dev-rag.cg.optimizely.com';

export default function GraphiQLPage() {
  const { singleKey } = useRagConfig();

  const graphiQLUrl = singleKey
    ? `${GRAPHIQL_ORIGIN}/app/graphiql?auth=${encodeURIComponent(singleKey)}`
    : null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            GraphiQL
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Query the ingested content through the Optimizely GraphiQL explorer.
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6 flex flex-col">
        {!graphiQLUrl ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Single key required
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">
              Add your single key on the{' '}
              <Link href="/connection" className="text-blue-600 dark:text-blue-400 underline">
                Connection
              </Link>{' '}
              page to enable the GraphiQL iframe.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Authenticated with single key.
              </p>
              <a
                href={graphiQLUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open in new tab
              </a>
            </div>
            <iframe
              src={graphiQLUrl}
              title="Optimizely GraphiQL"
              className="flex-1 w-full min-h-[600px] border-0"
              allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        )}
      </main>
    </div>
  );
}
