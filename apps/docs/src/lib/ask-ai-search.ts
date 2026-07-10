import { create, insertMultiple, search } from '@orama/orama';

export interface AskAiIndexEntry {
  url: string;
  title: string;
  description: string;
  content: string;
}

export interface AskAiResult {
  url: string;
  title: string;
  description: string;
  /** Real excerpt from the matched page's content, centered on the best-matching term. */
  excerpt: string;
  score: number;
}

let indexPromise: Promise<AskAiIndexEntry[]> | null = null;

/**
 * Fetches the build-time-generated retrieval index once per page session and caches it.
 * Backed by `/ask-ai-index.json` (`apps/docs/src/app/ask-ai-index.json/route.ts`), which is
 * real page content from `getLLMText()` — the same source `llms-full.txt` uses.
 */
function loadIndex(basePath: string): Promise<AskAiIndexEntry[]> {
  indexPromise ??= fetch(`${basePath}/ask-ai-index.json`).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Failed to load Ask AI index: ${res.status}`);
    }
    return (await res.json()) as AskAiIndexEntry[];
  });

  return indexPromise;
}

/**
 * Builds an excerpt centered on the first occurrence of any query term, so the result
 * shows real matched context rather than always the start of the page.
 */
function buildExcerpt(content: string, query: string, radius = 220): string {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);

  const lower = content.toLowerCase();
  let matchIndex = -1;

  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1 && (matchIndex === -1 || found < matchIndex)) {
      matchIndex = found;
    }
  }

  const center = matchIndex === -1 ? 0 : matchIndex;
  const start = Math.max(0, center - radius / 2);
  const end = Math.min(content.length, start + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';

  return `${prefix}${content.slice(start, end).trim().replace(/\s+/g, ' ')}${suffix}`;
}

/**
 * Minimal English stopword list. Orama's default full-text scoring ranks noise words
 * ("how", "do", "I", "add") alongside the real content terms, which measurably hurts ranking
 * for natural-language questions — verified directly: searching the raw query
 * "how do I add authentication" against the real built index ranked `guides/authentication`
 * 4th; stripping stopwords down to "authentication" ranked it 1st with a 3x higher score.
 * This is not exhaustive stemming/NLP — just enough to stop question words from diluting the
 * real query terms.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'how', 'what', 'when',
  'where', 'why', 'who', 'which', 'i', 'you', 'to', 'of', 'in', 'on', 'for', 'with', 'and',
  'or', 'can', 'could', 'should', 'would', 'my', 'me', 'it', 'this', 'that', 'add', 'use',
  'get', 'set',
]);

function toSearchTerm(query: string): string {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOPWORDS.has(term));

  // If stopword-stripping empties the query (e.g. a query that's entirely stopwords), fall
  // back to the raw query rather than searching for nothing.
  return terms.length > 0 ? terms.join(' ') : query;
}

/**
 * Real semantic-ish search over real docs content using Orama's BM25-style full-text ranking
 * (the same engine `fumadocs-core/search/server` uses for this site's real search box) — no
 * LLM call, no fabricated response. See the module doc comment in `ask-ai-index.json/route.ts`
 * for why: no LLM provider is configured in this environment, and the site is a static export
 * with no server to call one from even if a key existed.
 */
export async function askAi(query: string, basePath: string): Promise<AskAiResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const entries = await loadIndex(basePath);
  const term = toSearchTerm(trimmed);

  const db = create({
    schema: {
      url: 'string',
      title: 'string',
      description: 'string',
      content: 'string',
    } as const,
  });

  await insertMultiple(db, entries);

  const results = await search(db, {
    term,
    properties: ['title', 'description', 'content'],
    limit: 5,
    boost: { title: 3, description: 2, content: 1 },
  });

  return results.hits.map((hit) => ({
    url: hit.document.url,
    title: hit.document.title,
    description: hit.document.description,
    excerpt: buildExcerpt(hit.document.content, term),
    score: hit.score,
  }));
}
