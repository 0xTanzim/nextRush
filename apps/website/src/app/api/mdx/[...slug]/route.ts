import { getLLMText, source } from '@/lib/source';

export const dynamic = 'force-static';
export const revalidate = false;

function withMdExtension(slug: string): string {
  return slug.endsWith('.md') ? slug : `${slug}.md`;
}

function stripOptionalMdExtension(slug: string): string {
  return slug.endsWith('.md') ? slug.slice(0, -3) : slug;
}

function routeSlugToPageSlugs(routeSlugs: string[]): string[] | undefined {
  if (routeSlugs.length === 0) return undefined;

  const normalized = [...routeSlugs];
  const lastIndex = normalized.length - 1;
  normalized[lastIndex] = stripOptionalMdExtension(normalized[lastIndex]);

  if (normalized.length === 1 && normalized[0] === 'index') {
    return undefined;
  }

  return normalized;
}

function estimateTokens(text: string): number {
  // Rough token estimate: ~1.3 tokens per word for technical English.
  // Used for x-markdown-tokens header — agents use this to estimate
  // context-window consumption. Not a precise count.
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

export function generateStaticParams() {
  const pages = source.getPages();

  return pages
    .map((page) => {
      if (page.slugs.length === 0) {
        return { slug: ['index.md'] };
      }

      const slugs = [...page.slugs];
      slugs[slugs.length - 1] = withMdExtension(slugs[slugs.length - 1]);

      return { slug: slugs };
    })
    .toSorted((a, b) => a.slug.join('/').localeCompare(b.slug.join('/')));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const pageSlugs = routeSlugToPageSlugs(slug);
  const page = source.getPage(pageSlugs);

  if (!page) {
    return new Response('Page not found', { status: 404 });
  }

  const text = await getLLMText(page);
  const tokens = estimateTokens(text);

  return new Response(text, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'x-markdown-tokens': String(tokens),
    },
  });
}
