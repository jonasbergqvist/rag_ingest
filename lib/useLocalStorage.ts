'use client';

import { useEffect, useState, useCallback } from 'react';

const STORAGE_EVENT = 'rag-storage-change';

function readStorage(key: string, defaultValue: string): string {
  if (typeof window === 'undefined') return defaultValue;
  return window.localStorage.getItem(key) ?? defaultValue;
}

export function useLocalStorageString(
  key: string,
  defaultValue: string = ''
): [string, (value: string) => void] {
  // Initialise with the default so the first server and client renders match.
  // localStorage is read only after hydration in the effect below.
  const [value, setValueState] = useState(defaultValue);

  // Read the persisted value after mount and keep the returned value in sync
  // with changes from other tabs/components.
  useEffect(() => {
    setValueState(readStorage(key, defaultValue));
    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) {
        setValueState(readStorage(key, defaultValue));
      }
    };

    const handleCustom = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (custom.detail === key) {
        setValueState(readStorage(key, defaultValue));
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(STORAGE_EVENT, handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(STORAGE_EVENT, handleCustom);
    };
  }, [key, defaultValue]);

  const setValue = useCallback(
    (next: string) => {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, next);
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: key }));
      setValueState(next);
    },
    [key]
  );

  return [value, setValue];
}
