'use client';

import { useCallback, useRef, useState } from 'react';
import type { CrawledItem } from '@/lib/types';

interface Props {
  onItemsLoaded: (items: CrawledItem[]) => void;
  disabled?: boolean;
}

export default function DragDropZone({ onItemsLoaded, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState<number | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      setParseError(null);
      setParseWarnings([]);
      const fileArray = Array.from(files).filter(
        (f) => f.name.endsWith('.json') || f.type === 'application/json'
      );

      if (fileArray.length === 0) {
        setParseError('No JSON files found. Please drop .json files.');
        return;
      }

      const allItems: CrawledItem[] = [];
      const warnings: string[] = [];

      for (const file of fileArray) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const items: CrawledItem[] = Array.isArray(parsed) ? parsed : [parsed];
          allItems.push(...items);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push(`${file.name}: ${msg}`);
        }
      }

      setParseWarnings(warnings);

      if (allItems.length === 0) {
        setParseError(
          warnings.length > 0
            ? 'All files failed to parse.'
            : 'No items found in the provided files.'
        );
        return;
      }

      setLoadedCount(allItems.length);
      onItemsLoaded(allItems);
    },
    [onItemsLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      processFiles(e.dataTransfer.files);
    },
    [disabled, processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files);
    },
    [processFiles]
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop JSON files here or click to browse"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className={[
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-3">
          <svg
            className={`w-12 h-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          {loadedCount !== null ? (
            <div className="text-green-600 dark:text-green-400 font-medium">
              <span className="text-lg">{loadedCount} items loaded</span>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Drop more files to replace, or proceed below
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                Drop JSON crawl files here
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                or click to browse &mdash; accepts one or more .json files
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Each file should contain a JSON array of crawled items
              </p>
            </div>
          )}
        </div>
      </div>

      {parseError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{parseError}</p>
      )}

      {parseWarnings.length > 0 && (
        <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
          <p className="font-medium">{parseWarnings.length} file{parseWarnings.length > 1 ? 's' : ''} failed to parse:</p>
          <ul className="mt-1 text-xs space-y-0.5">
            {parseWarnings.map((w, i) => (
              <li key={i} className="font-mono">{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
