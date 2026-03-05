import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

export function generateStaticParams() {
  const pages = source.getPages();
  const slugStrings = new Set(pages.map((p) => p.slugs.join('/')));

  return pages
    .filter((page) => {
      if (page.slugs.length === 0) return false;
      // Exclude pages whose slug is a prefix of another page's slug
      // to prevent file/directory collision during static export
      const prefix = page.slugs.join('/') + '/';
      for (const s of slugStrings) {
        if (s.startsWith(prefix)) return false;
      }
      return true;
    })
    .map((page) => ({
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
