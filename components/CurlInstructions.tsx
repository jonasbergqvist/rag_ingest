'use client';

import { useState } from 'react';

interface Props {
  baseUrl: string;
  appKey: string;
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 text-xs rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed font-mono">
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  description: string;
  code: string;
  note?: string;
}

function Step({ number, title, description, code, note }: StepProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
          {number}
        </span>
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <CodeBlock code={code} />
      {note && (
        <p className="text-xs text-amber-600 dark:text-amber-400 pl-8">
          <span className="font-semibold">Note:</span> {note}
        </p>
      )}
    </div>
  );
}

export default function CurlInstructions({ baseUrl, appKey }: Props) {
  const base = baseUrl.replace(/\/$/, '') || 'https://rag-poc.cg.optimizely.com';
  const key = appKey || '$APP_KEY';
  const secret = '$SECRET';
  const importId = '$IMPORT_ID';

  const authHeader = `Authorization: "Basic $(echo -n '${key}:${secret}' | base64)"`;

  const steps: StepProps[] = [
    {
      number: 1,
      title: 'Start an import session',
      description:
        'Request a new import ID from the RAG service. This also provisions the "merc" content source if it does not already exist.',
      code: `curl -s -X GET \\
  "${base}/rag/import" \\
  -H ${authHeader}

# Response:
# { "importId": "550e8400-e29b-41d4-a716-446655440000" }`,
      note: 'Save the importId from the response — you will need it for all subsequent steps.',
    },
    {
      number: 2,
      title: 'Send items one by one',
      description:
        'POST crawled items to the import endpoint. Send 1 item per request. Repeat until all items are sent. Each item must include SourceUrl, PageTitle, BodyHtml, BodyMarkdown, HttpStatus, ContentHash, CrawledAt, and RunId.',
      code: `curl -s -X POST \\
  "${base}/rag/import/items" \\
  -H ${authHeader} \\
  -H "Content-Type: application/json" \\
  -d '{
    "importId": "${importId}",
    "items": [
      {
        "SourceUrl": "https://example.com/page-1",
        "PageTitle": "Page Title",
        "BodyHtml": "<!doctype html><html lang=\\"en\\"><body>...</body></html>",
        "BodyMarkdown": "# Page Title\\n\\nContent here...",
        "HttpStatus": 200,
        "ContentHash": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
        "CrawledAt": "2026-06-01T08:00:00.000Z",
        "RunId": "my-crawl-run-001"
      }
    ]
  }'

# Response:
# { "accepted": 1 }`,
      note:
        'Repeat this call for each item. The "accepted" count should equal 1.',
    },
    {
      number: 3,
      title: 'Signal that all items have been sent',
      description:
        'Once all batches are sent, call the /done endpoint. This marks the import as complete and triggers the bootstrap workflow that processes content into the RAG graph.',
      code: `curl -s -X GET \\
  "${base}/rag/import/${importId}/done" \\
  -H ${authHeader}

# Response:
# { "status": "bootstrapping" }`,
      note:
        'Bootstrap runs asynchronously. Poll the status endpoint to track progress.',
    },
    {
      number: 4,
      title: 'Poll for status (every 10 seconds)',
      description:
        'Keep polling until bootstrap is "ready" (success) or "error" (failure). The counts fields show how many items have been enqueued, processed, succeeded, or failed.',
      code: `curl -s -X GET \\
  "${base}/rag/import/${importId}/status" \\
  -H ${authHeader}

# Response while processing:
# {
#   "importId": "${importId}",
#   "status": "bootstrapping",
#   "counts": {
#     "enqueued": 10,
#     "processed": 7,
#     "succeeded": 7,
#     "failed": 0
#   },
#   "bootstrap": "bootstrapping",
#   "bootstrapError": null
# }

# Final success response:
# {
#   "importId": "${importId}",
#   "status": "bootstrapping",
#   "counts": { "enqueued": 10, "processed": 10, "succeeded": 10, "failed": 0 },
#   "bootstrap": "ready",
#   "bootstrapError": null
# }`,
      note:
        'Stop polling when bootstrap is "ready" or "error". An "error" response will include a bootstrapError message.',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          How to Import via CURL
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          The same 4-step flow this app performs — as shell commands.
          {baseUrl && appKey && (
            <span className="text-blue-600 dark:text-blue-400">
              {' '}URLs and App Key are pre-filled from your config.
            </span>
          )}
        </p>
      </div>

      <div className="space-y-5">
        {steps.map((step) => (
          <Step key={step.number} {...step} />
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
          Auth reference
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          All endpoints (except <code className="font-mono text-gray-700 dark:text-gray-300">/rag/health</code>) require{' '}
          <code className="font-mono text-gray-700 dark:text-gray-300">Authorization: Basic base64(appKey:secret)</code>.
          Three schemes are accepted:
        </p>
        <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc list-inside">
          <li><code className="font-mono">Basic base64(appKey:secret)</code> — standard HTTP Basic</li>
          <li><code className="font-mono">epi-hmac appKey:timestamp:nonce:sig</code> — HMAC signed</li>
          <li><code className="font-mono">epi-single &lt;appKey&gt;</code> — single key (dev only)</li>
        </ul>
      </div>
    </div>
  );
}
