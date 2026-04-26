import { appConfig, toAbsoluteUrl } from '@/config/appConfig';
import { getLLMText, source } from '@/lib/source';

export const dynamic = 'force-static';
export const revalidate = false;

const HEADER = `# ${appConfig.name} — Full Documentation

> Complete documentation for ${appConfig.name}. ${appConfig.llms.summary}

---`;

export async function GET() {
  const pages = source
    .getPages()
    .toSorted((a, b) => a.url.localeCompare(b.url) || a.data.title.localeCompare(b.data.title));

  const scanned = await Promise.all(
    pages.map(async (page) => {
      try {
        return await getLLMText(page);
      } catch {
        return `# ${page.data.title}

Failed to generate markdown for this page.

Source: ${toAbsoluteUrl(page.url)}`;
      }
    })
  );

  const body = `${HEADER}\n\n${scanned.join('\n\n')}`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
