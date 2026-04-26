import { LLMCopyButton, ViewOptions } from '@/components/page-actions';
import { getPageImage, source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const GITHUB_REPO_URL = 'https://github.com/0xTanzim/nextRush';
const GITHUB_BRANCH = process.env.NEXTRUSH_REPO_BRANCH ?? 'main';
const CONTENT_BASE = 'apps/docs/content/docs';
const DOCS_BASE_PATH = (() => {
  const basePath = process.env.NEXTRUSH_DOCS_BASE_PATH ?? '';

  if (!basePath || basePath === '/') return '';

  return basePath.startsWith('/') ? basePath : `/${basePath}`;
})();

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const slugPath = page.slugs.join('/');
  const markdownPath = slugPath.length > 0 ? slugPath : 'index';
  const markdownUrl = `${DOCS_BASE_PATH}/api/mdx/${markdownPath}.md`;
  const llmsUrl = `${DOCS_BASE_PATH}/llms.txt`;
  const githubUrl = `${GITHUB_REPO_URL}/blob/${GITHUB_BRANCH}/${CONTENT_BASE}/${page.path}`;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="mb-8 flex flex-row items-center gap-2 rounded-2xl border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-card)_78%,transparent)] p-2 shadow-[0_16px_48px_-34px_color-mix(in_srgb,var(--rush-blue)_45%,transparent)] backdrop-blur">
        <LLMCopyButton markdownUrl={markdownUrl} />
        <ViewOptions markdownUrl={markdownUrl} githubUrl={githubUrl} llmsUrl={llmsUrl} />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
