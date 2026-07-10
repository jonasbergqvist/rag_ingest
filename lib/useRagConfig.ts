'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocalStorageString } from './useLocalStorage';
import type { RagCredentials } from './types';

const STORAGE_KEY = 'rag_ingest_config';
const SINGLE_KEY_STORAGE = 'rag_connection_singleKey';

function loadPersistedPart(): RagCredentials {
  if (typeof window === 'undefined') {
    return { baseUrl: '', appKey: '', secret: '' };
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        baseUrl: parsed.baseUrl ?? '',
        appKey: parsed.appKey ?? '',
        secret: parsed.secret ?? '',
      };
    } catch {
      // ignore parse errors
    }
  }

  return { baseUrl: '', appKey: '', secret: '' };
}

function persistPart(credentials: RagCredentials) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      baseUrl: credentials.baseUrl,
      appKey: credentials.appKey,
      secret: credentials.secret,
    })
  );
}

export function useRagConfig() {
  // Start with empty defaults so the server and client first renders match.
  // The persisted values are loaded after hydration in the effect below.
  const [credentials, setCredentialsState] = useState<RagCredentials>({
    baseUrl: '',
    appKey: '',
    secret: '',
  });

  useEffect(() => {
    setCredentialsState((prev) => ({ ...prev, ...loadPersistedPart() }));
  }, []);

  const [singleKey, setSingleKey] = useLocalStorageString(SINGLE_KEY_STORAGE, '');

  const setCredentials = useCallback(
    (next: RagCredentials | ((prev: RagCredentials) => RagCredentials)) => {
      setCredentialsState((prev) => {
        const updated = typeof next === 'function' ? next(prev) : next;
        persistPart(updated);
        return updated;
      });
    },
    []
  );

  const updateCredentials = useCallback(
    (patch: Partial<RagCredentials>) => {
      setCredentials((prev) => ({ ...prev, ...patch }));
    },
    [setCredentials]
  );

  return {
    credentials,
    singleKey,
    setCredentials,
    updateCredentials,
    setSingleKey,
  };
}
