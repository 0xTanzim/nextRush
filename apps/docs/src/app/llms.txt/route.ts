import { appConfig, appEndpoints, toAbsoluteUrl } from '@/config/appConfig';
import { skillsSource, source } from '@/lib/source';
import type { InferPageType } from 'fumadocs-core/source';

export const dynamic = 'force-static';
export const revalidate = false;

const SECTION_TITLES: Record<string, string> = appConfig.llms.sectionTitles;

const SECTION_ORDER = Object.keys(SECTION_TITLES);

function formatSectionTitle(sectionKey: string): string {
  const knownTitle = SECTION_TITLES[sectionKey];
  if (knownTitle) {
    return knownTitle;
  }

  return sectionKey
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function comparePages(a: InferPageType<typeof source>, b: InferPageType<typeof source>): number {
  const aSlug = a.slugs.join('/');
  const bSlug = b.slugs.join('/');

  return aSlug.localeCompare(bSlug) || a.data.title.localeCompare(b.data.title);
}

function toMarkdownUrl(page: InferPageType<typeof source>): string {
  const slugPath = page.slugs.join('/');
  const path = slugPath.length > 0 ? `${slugPath}.md` : 'index.md';

  return toAbsoluteUrl(`${appConfig.paths.markdownApiPrefix}/${path}`);
}

function toCanonicalPageUrl(page: InferPageType<typeof source>): string {
  return toAbsoluteUrl(page.url);
}

export async function GET() {
  const pages = source.getPages().toSorted(comparePages);

  const grouped = new Map<string, typeof pages>();

  for (const page of pages) {
    const section = page.slugs[0];
    if (!section) continue;

    const existing = grouped.get(section);
    if (existing) {
      existing.push(page);
    } else {
      grouped.set(section, [page]);
    }
  }

  const knownSections = SECTION_ORDER.filter((section) => grouped.has(section));
  const unknownSections = [...grouped.keys()]
    .filter((section) => !SECTION_TITLES[section])
    .sort((a, b) => a.localeCompare(b));
  const orderedSections = [...knownSections, ...unknownSections];

  const lines: string[] = [
    `# ${appConfig.name}`,
    '',
    `> ${appConfig.llms.summary}`,
    '',
    appConfig.llms.intro,
    '',
  ];

  for (const sectionKey of orderedSections) {
    const sectionPages = grouped.get(sectionKey);
    if (!sectionPages?.length) continue;

    const title = formatSectionTitle(sectionKey);
    lines.push(`## ${title}`, '');

    for (const page of sectionPages.toSorted(comparePages)) {
      const markdownUrl = toMarkdownUrl(page);
      const canonicalPage = toCanonicalPageUrl(page);
      const description = page.data.description ? `: ${page.data.description}` : '';
      lines.push(`- [${page.data.title}](${markdownUrl})${description} (Page: ${canonicalPage})`);
    }

    lines.push('');
  }

  const skillPages = skillsSource
    .getPages()
    .toSorted((a, b) => a.url.localeCompare(b.url) || a.data.title.localeCompare(b.data.title));
  if (skillPages.length > 0) {
    lines.push('## Agent Skills', '');
    for (const skill of skillPages) {
      const description = skill.data.description ? `: ${skill.data.description}` : '';
      lines.push(`- [${skill.data.title}](${toAbsoluteUrl(skill.url)})${description}`);
    }
    lines.push('');
  }

  lines.push(
    '## Optional',
    '',
    `- [Full Documentation](${appEndpoints.llmsFullTxt}): Complete concatenated documentation for all pages`,
    `- [Skills Index](${appEndpoints.skillsJson}): Machine-readable skills catalog (JSON)`,
    ''
  );

  return new Response(lines.join('\n').replace(/\n{3,}/g, '\n\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
