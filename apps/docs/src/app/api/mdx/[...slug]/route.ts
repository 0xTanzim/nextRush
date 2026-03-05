import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!page) {
    return new Response('Page not found', { status: 404 });
  }

  const text = await getLLMText(page);

  return new Response(text, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
