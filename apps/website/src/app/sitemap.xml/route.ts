import { appConfig, toAbsoluteUrl } from '@/config/appConfig';
import { skillsSource, source } from '@/lib/source';

export const dynamic = 'force-static';
export const revalidate = false;

function xmlUrl(loc: string, priority: string, changefreq: string): string {
  return `  <url><loc>${toAbsoluteUrl(loc)}</loc><priority>${priority}</priority><changefreq>${changefreq}</changefreq></url>`;
}

export function GET() {
  const urls: string[] = [];

  urls.push(xmlUrl('', '1.0', 'weekly'));
  urls.push(xmlUrl('/docs', '0.9', 'weekly'));
  urls.push(xmlUrl('/skills', '0.8', 'weekly'));
  urls.push(xmlUrl('/llm.txt', '0.5', 'monthly'));
  urls.push(xmlUrl('/llms.txt', '0.7', 'weekly'));
  urls.push(xmlUrl('/llms-full.txt', '0.6', 'monthly'));
  urls.push(xmlUrl('/skills.json', '0.4', 'weekly'));
  urls.push(xmlUrl('/mcp.json', '0.4', 'weekly'));
  urls.push(xmlUrl('/agent-spec.json', '0.5', 'monthly'));

  for (const page of source.getPages()) {
    urls.push(xmlUrl(page.url, '0.7', 'weekly'));
  }

  for (const page of skillsSource.getPages()) {
    urls.push(xmlUrl(page.url, '0.6', 'monthly'));
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
