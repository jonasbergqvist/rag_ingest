'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRagConfig } from '@/lib/useRagConfig';
import { queryRag } from '@/lib/ragApi';
import { FIELD_NOTES_QUESTIONS } from '@/lib/fieldNotesQuestions';
import type { RagQueryResponse } from '@/lib/types';

export default function QuestionsPage() {
  const { credentials } = useRagConfig();

  const [answers, setAnswers] = useState<Record<string, RagQueryResponse>>({});
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState<string | null>(null);
  const [errorQuestion, setErrorQuestion] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');

  const hasCredentials =
    credentials.baseUrl.trim() !== '' &&
    credentials.appKey.trim() !== '' &&
    credentials.secret.trim() !== '';

  const handleSelectQuestion = useCallback(
    async (question: string) => {
      setSelectedQuestion(question);
      if (answers[question]) return;

      setLoadingQuestion(question);
      setErrorQuestion(null);

      try {
        const result = await queryRag(credentials, question);
        setAnswers((prev) => ({ ...prev, [question]: normalizeAnswer(result) }));
      } catch (e) {
        setErrorQuestion(e instanceof Error ? e.message : 'Failed to fetch answer');
      } finally {
        setLoadingQuestion(null);
      }
    },
    [answers, credentials]
  );

  const handleCustomSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = customInput.trim();
    if (!question || !hasCredentials) return;
    setCustomInput('');
    handleSelectQuestion(question);
  };

  const selectedAnswer = selectedQuestion ? answers[selectedQuestion] : null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Questions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Explore the ingested Field Notes content by selecting a question, or type your own.
          </p>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <aside className="lg:sticky lg:top-6 space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              Field Notes questions
            </h3>
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {FIELD_NOTES_QUESTIONS.map((question) => {
                const isActive = selectedQuestion === question;
                const isAnswered = !!answers[question];
                const isLoading = loadingQuestion === question;

                return (
                  <li key={question}>
                    <button
                      type="button"
                      onClick={() => handleSelectQuestion(question)}
                      disabled={isLoading || !hasCredentials}
                      className={[
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-start gap-2',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-transparent',
                        !hasCredentials ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      <span className="shrink-0 mt-0.5">
                        {isLoading ? (
                          <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : isAnswered ? (
                          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </span>
                      <span>{question}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              Ask your own question
            </h3>
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Type a question about the content…"
                disabled={!hasCredentials}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!customInput.trim() || !hasCredentials}
                className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
              >
                Ask question
              </button>
            </form>
          </div>

          {!hasCredentials && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
              Configure your RAG connection on the{' '}
              <Link href="/connection" className="underline hover:text-amber-900 dark:hover:text-amber-200">
                Connection
              </Link>{' '}
              page before exploring.
            </div>
          )}
        </aside>

        <section className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm min-h-[calc(100vh-220px)]">
          {!selectedQuestion ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Select or type a question</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                Choose one of the pre-defined questions, or write your own. The RAG system will generate an answer,
                the GraphQL query it ran, and the variables it used.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Question
                </h3>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{selectedQuestion}</p>
              </div>

              {loadingQuestion === selectedQuestion ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-8">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Asking the RAG graph…
                </div>
              ) : errorQuestion ? (
                <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">Could not fetch answer</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errorQuestion}</p>
                </div>
              ) : selectedAnswer ? (
                <>
                  <section>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Answer
                    </h3>
                    <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedAnswer.answer}
                    </div>
                  </section>

                  {selectedAnswer.sources && selectedAnswer.sources.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Sources
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedAnswer.sources.map((source, index) => (
                          <a
                            key={index}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            title={source.url}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            {source.title || source.url}
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {selectedAnswer.queryExecuted && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Generated GraphQL query
                      </h3>
                      <pre className="text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 overflow-auto max-h-96 text-gray-800 dark:text-gray-200">
                        {selectedAnswer.queryExecuted}
                      </pre>
                    </section>
                  )}

                  {selectedAnswer.variablesUsed && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Variables
                      </h3>
                      <pre className="text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 overflow-auto max-h-60 text-gray-800 dark:text-gray-200">
                        {JSON.stringify(selectedAnswer.variablesUsed, null, 2)}
                      </pre>
                    </section>
                  )}
                </>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function normalizeAnswer(raw: unknown): RagQueryResponse {
  if (typeof raw === 'string') {
    return { answer: raw };
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const answer =
      typeof obj.answer === 'string'
        ? obj.answer
        : typeof obj.response === 'string'
          ? obj.response
          : JSON.stringify(raw, null, 2);

    let sources: RagQueryResponse['sources'];
    if (Array.isArray(obj.sources)) {
      sources = obj.sources
        .filter((s): s is { title?: string; url?: string; contentType?: string; score?: number } =>
          s !== null && typeof s === 'object'
        )
        .map((s) => ({
          title: s.title ?? s.contentType ?? 'Source',
          url: s.url,
          contentType: s.contentType,
          score: s.score,
        }));
    }

    const queryExecuted = typeof obj.queryExecuted === 'string' ? obj.queryExecuted : undefined;

    const variablesUsed =
      obj.variablesUsed && typeof obj.variablesUsed === 'object' && !Array.isArray(obj.variablesUsed)
        ? (obj.variablesUsed as Record<string, unknown>)
        : undefined;

    return { answer, sources, queryExecuted, variablesUsed };
  }

  return { answer: String(raw) };
}
