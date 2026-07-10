'use client';

import { useState } from 'react';
import ConfigPanel from '@/components/ConfigPanel';
import { useRagConfig } from '@/lib/useRagConfig';
import type { RagCredentials } from '@/lib/types';

export default function ConnectionPage() {
  const {
    credentials,
    singleKey,
    setCredentials,
    setSingleKey,
  } = useRagConfig();

  const handleCredentialsChange = (next: RagCredentials) => {
    setCredentials(next);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Configure connection
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            These settings are stored locally and used by ingest, the landing page, and GraphiQL.
          </p>
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-6 py-6 space-y-6">
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
            RAG service credentials
          </h3>
          <ConfigPanel
            credentials={credentials}
            onChange={handleCredentialsChange}
          />
        </section>

        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Single key
          </h3>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            The single key is used by the GraphiQL explorer and can also be used by the landing page.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Single key
            </label>
            <input
              type="text"
              value={singleKey}
              onChange={(e) => setSingleKey(e.target.value)}
              placeholder="Paste your single key here"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {singleKey ? (
            <CopyableKey value={singleKey} />
          ) : (
            <p className="text-sm text-gray-400 italic">
              No single key configured yet.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function CopyableKey({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-md px-3 py-2 break-all border border-gray-200 dark:border-gray-700">
        {value}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
