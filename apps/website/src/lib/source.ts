import { type InferPageType, loader } from 'fumadocs-core/source';
import { toFumadocsSource } from 'fumadocs-mdx/runtime/server';
import { blog as blogCollection, docs, skills as skillsCollection } from 'fumadocs-mdx:collections/server';
import { i18n } from '@/lib/i18n';
import { createElement } from 'react';
import {
  Activity,
  BadgeCheck,
  Blocks,
  BookOpen,
  Boxes,
  Inbox,
  LayoutTemplate,
  Radio,
  Server,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons referenced by `icon` in Reference capability-folder meta.json files. Only the
 * icons actually used are imported (not the whole set) to keep the server bundle small.
 * An `icon` value with no entry here renders no icon rather than leaking its name as text.
 */
const REFERENCE_ICONS: Record<string, LucideIcon> = {
  Boxes,
  Inbox,
  ShieldCheck,
  BadgeCheck,
  LayoutTemplate,
  Activity,
  Radio,
  BookOpen,
  Blocks,
  Server,
  Wrench,
};

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  i18n,
  icon(name) {
    if (name && name in REFERENCE_ICONS) return createElement(REFERENCE_ICONS[name]);
  },
  plugins: [],
});

export const skillsSource = loader({
  baseUrl: '/skills',
  source: toFumadocsSource(skillsCollection, []),
});

export const blogSource = loader({
  baseUrl: '/blog',
  source: toFumadocsSource(blogCollection, []),
});

function sanitizeLLMMarkdown(markdown: string): string {
  const segments = markdown.split(/(```[\s\S]*?```)/g);

  const sanitized = segments.map((segment, index) => {
    // Keep code fences untouched
    if (index % 2 === 1 && segment.startsWith('```')) {
      return segment;
    }

    return segment
      .replace(/<Mermaid[\s\S]*?\/>/g, '')
      .replace(/^\s*<\/?[A-Z][A-Za-z0-9]*(?:\s+[^>]*)?>\s*$/gm, '')
      .replace(/^\s*(import|export)\s.+$/gm, '');
  });

  return sanitized
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  };
}

export function getBlogPageImage(page: InferPageType<typeof blogSource>): {
  segments: string[];
  url: string;
} {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/blog/${segments.join('/')}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  let processed = await page.data.getText('processed');

  if (!processed.trim()) {
    processed = await page.data.getText('raw');
  }

  const cleaned = sanitizeLLMMarkdown(processed);

  return `# ${page.data.title}

${cleaned}`;
}
