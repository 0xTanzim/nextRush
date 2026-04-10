import { type InferPageType, loader } from 'fumadocs-core/source';
import { toFumadocsSource } from 'fumadocs-mdx/runtime/server';
import { docs, skills as skillsCollection } from 'fumadocs-mdx:collections/server';

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [],
});

export const skillsSource = loader({
  baseUrl: '/skills',
  source: toFumadocsSource(skillsCollection, []),
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

export async function getLLMText(page: InferPageType<typeof source>) {
  let processed = await page.data.getText('processed');

  if (!processed.trim()) {
    processed = await page.data.getText('raw');
  }

  const cleaned = sanitizeLLMMarkdown(processed);

  return `# ${page.data.title}

${cleaned}`;
}
