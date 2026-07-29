'use client';

import { askAi, type AskAiResult } from '@/lib/ask-ai-search';
import { Loader2, Search, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '../lib/cn';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

/**
 * "Ask AI" nav slot.
 *
 * T21 (Phase 5, docs/documentation-rebuild/PLAN.md) wires this to real docs content.
 *
 * This is genuine retrieval, not a generated chat answer: no LLM provider is configured
 * anywhere in this repo (no API key env vars, no `@ai-sdk/*` usage — confirmed by search
 * before building this), and the site is a full static export (`output: 'export'` in
 * `next.config.mjs`) with no server to call a generation API from even if a key existed.
 * Every result is a real excerpt from a real page in `apps/website/content/docs/**`, ranked by
 * Orama full-text search (`@orama/orama`, the same engine `fumadocs-core/search/server` uses
 * for the site's real search box) over `/ask-ai-index.json` (built from `getLLMText()`, the
 * same function `llms-full.txt` uses). See `apps/website/src/lib/ask-ai-search.ts` for the
 * retrieval logic and `apps/website/src/app/ask-ai-index.json/route.ts` for the index.
 */
export function AskAiTrigger() {
  const basePath = useBasePath();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AskAiResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const hits = await askAi(query, basePath);
      setResults(hits);
    } catch {
      setError('Could not load the docs index. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        title="Ask AI — real search over NextRush docs content, no fabricated answers"
        aria-label="Ask AI"
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground cursor-pointer"
      >
        <Sparkles className="size-4" aria-hidden />
        <span className="hidden sm:inline">Ask AI</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-3">
        <p className="mb-3 text-xs text-fd-muted-foreground">
          Searches real NextRush docs content and returns the most relevant page excerpts. This
          is retrieval, not a generated chat answer — no LLM provider is configured for this
          deployment.
        </p>

        <form onSubmit={runSearch} className="flex items-center gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="How do I add authentication?"
            className="flex-1 rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fd-primary"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-fd-primary px-3 py-2 text-sm font-medium text-fd-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-fd-destructive">{error}</p>}

        {results && results.length === 0 && !loading && (
          <p className="mt-3 text-sm text-fd-muted-foreground">No matching pages found.</p>
        )}

        {results && results.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2 max-h-96 overflow-y-auto">
            {results.map((result) => (
              <li key={result.url}>
                <a
                  href={`${basePath}${result.url}`}
                  className={cn(
                    'block rounded-lg border border-fd-border p-3 text-sm transition-colors',
                    'hover:border-fd-primary hover:bg-fd-accent'
                  )}
                >
                  <div className="font-medium text-fd-foreground">{result.title}</div>
                  <p className="mt-1 text-xs text-fd-muted-foreground">{result.excerpt}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Resolves the app's base path client-side from the current pathname — mirrors the
 * server-side `NEXTRUSH_DOCS_BASE_PATH` env read in `app/docs/[[...slug]]/page.tsx`, but done
 * from the rendered URL since a client component has no access to server env vars at runtime
 * in a static export.
 */
function useBasePath(): string {
  const pathname = usePathname();
  const docsIndex = pathname.indexOf('/docs');
  return docsIndex > 0 ? pathname.slice(0, docsIndex) : '';
}
