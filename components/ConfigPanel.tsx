'use client';

import { useState } from 'react';
import type { RagCredentials } from '@/lib/types';

interface Props {
  credentials: RagCredentials;
  onChange: (credentials: RagCredentials) => void;
  disabled?: boolean;
}

export default function ConfigPanel({ credentials, onChange, disabled }: Props) {
  const [showSecret, setShowSecret] = useState(false);

  const update = (patch: Partial<RagCredentials>) => {
    onChange({ ...credentials, ...patch });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
        Connection
      </h3>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          RAG Base URL
        </label>
        <input
          type="url"
          value={credentials.baseUrl}
          onChange={(e) => update({ baseUrl: e.target.value })}
          disabled={disabled}
          placeholder="https://rag-poc.cg.optimizely.com"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          App Key
        </label>
        <input
          type="text"
          value={credentials.appKey}
          onChange={(e) => update({ appKey: e.target.value })}
          disabled={disabled}
          placeholder="3emKFJW4..."
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Secret
        </label>
        <div className="relative">
          <input
            type={showSecret ? 'text' : 'password'}
            value={credentials.secret}
            onChange={(e) => update({ secret: e.target.value })}
            disabled={disabled}
            placeholder="wKj6s6Nr..."
            className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowSecret((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label={showSecret ? 'Hide secret' : 'Show secret'}
          >
            {showSecret ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">Stored locally in your browser</p>
      </div>
    </div>
  );
}
