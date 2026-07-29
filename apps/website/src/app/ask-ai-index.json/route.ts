import { getLLMText, source } from '@/lib/source';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

/**
 * Static retrieval index for the "Ask AI" feature (T21).
 *
 * This repo has no LLM provider configured (no `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` /
 * `@ai-sdk/*` usage anywhere — confirmed by search before building this). The site is also a
 * full static export (`next.config.mjs`'s `output: 'export'`), so there is no live server to
 * run a generation call against even if a key existed later.
 *
 * "Ask AI" is therefore built as a genuine **retrieval-only** feature: this route builds one
 * static JSON document at build time from the same `getLLMText()` used by `llms-full.txt`
 * (`apps/website/src/lib/source.ts`) — real page titles, descriptions, and sanitized Markdown
 * bodies for every real docs page. The client (`ask-ai-panel.tsx`) fetches this once and
 * ranks pages with Orama (`@orama/orama`, already a dependency — the same engine
 * `fumadocs-core/search/server` uses for the site's real full-text search), then shows the
 * highest-scoring page section(s) verbatim. There is no fabricated chat response: every answer
 * is a real excerpt from a real page, with a link to that page.
 */
export async function GET() {
  const pages = source.getPages();

  const entries = await Promise.all(
    pages.map(async (page) => {
      const text = await getLLMText(page);
      // Strip the leading "# Title" line getLLMText prepends — the page title is already
      // carried separately in `title` below, so keeping it in `content` would double-count it
      // during search ranking.
      const content = text.replace(/^#\s+.+\n+/, '');

      return {
        url: page.url,
        title: page.data.title,
        description: page.data.description ?? '',
        content,
      };
    })
  );

  return NextResponse.json(entries, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
