import { appConfig } from '@/config/appConfig';

export const dynamic = 'force-static';
export const revalidate = false;

export function GET() {
  const sitemapUrl = `${appConfig.siteUrl.replace(/\/$/, '')}/sitemap.xml`;

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
