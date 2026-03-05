import { skillsSource, source } from '@/lib/source';

export const revalidate = false;

const SITE_URL = 'https://nextrush.dev';

const SECTION_TITLES: Record<string, string> = {
  'getting-started': 'Getting Started',
  concepts: 'Core Concepts',
  architecture: 'Architecture',
  packages: 'Packages',
  guides: 'Guides',
  examples: 'Examples',
  benchmarks: 'Benchmarks',
  community: 'Community',
};

const SECTION_ORDER = Object.keys(SECTION_TITLES);

export async function GET() {
  const pages = source.getPages();

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

  const lines: string[] = [
    '# NextRush',
    '',
    '> A minimal, modular, high-performance Node.js backend framework with zero runtime dependencies.',
    '',
    'NextRush v3 is a TypeScript-first framework built as a modular monorepo. It supports both functional and class-based (decorator + DI) paradigms, targets 30,000+ RPS, and ships under 3,000 LOC in its core.',
    '',
  ];

  for (const sectionKey of SECTION_ORDER) {
    const sectionPages = grouped.get(sectionKey);
    if (!sectionPages?.length) continue;

    const title = SECTION_TITLES[sectionKey];
    lines.push(`## ${title}`, '');

    for (const page of sectionPages) {
      const slug = page.slugs.join('/');
      const url = `${SITE_URL}/api/mdx/${slug}`;
      const description = page.data.description ? `: ${page.data.description}` : '';
      lines.push(`- [${page.data.title}](${url})${description}`);
    }

    lines.push('');
  }

  const skillPages = skillsSource.getPages();
  if (skillPages.length > 0) {
    lines.push('## Agent Skills', '');
    for (const skill of skillPages) {
      const description = skill.data.description ? `: ${skill.data.description}` : '';
      lines.push(`- [${skill.data.title}](${SITE_URL}${skill.url})${description}`);
    }
    lines.push('');
  }

  lines.push(
    '## Optional',
    '',
    `- [Full Documentation](${SITE_URL}/llms-full.txt): Complete concatenated documentation for all pages`,
    `- [Skills Index](${SITE_URL}/skills.json): Machine-readable skills catalog (JSON)`,
    ''
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
