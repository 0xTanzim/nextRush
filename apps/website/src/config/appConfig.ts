import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nextrush.dev';

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), '../../packages/nextrush/package.json'), 'utf8')) as { version: string };

export const appConfig = {
  name: 'NextRush',
  id: 'nextrush',
  version: pkg.version,
  teamName: 'NextRush Team',
  twitterHandle: '@nextrush',
  siteUrl: SITE_URL,
  repositoryUrl: 'https://github.com/0xTanzim/nextRush',
  /** Canonical folder for Agent Skills source in the repo (`skills/<name>/SKILL.md`). */
  skillsSourceRootUrl: 'https://github.com/0xTanzim/nextRush/tree/main/skills',
  /** Social-preview cards are URL-stable; crawlers cache them eagerly (§ _headers `/og/*`). */
  og: {
    defaultImage: '/og/og.png',
    defaultImageAbsolute: `${SITE_URL}/og/og.png`,
    width: 1200,
    height: 630,
    alt: 'NextRush — TypeScript backend framework',
  },
  organization: {
    name: 'NextRush',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      'https://github.com/0xTanzim/nextRush',
      'https://www.linkedin.com/company/nextrush',
      'https://x.com/0xTanzim',
    ],
    founder: {
      '@type': 'Person',
      name: 'Tanzim Hossain',
      alternateName: '0xTanzim',
      url: 'https://0xtanzim.dev',
      sameAs: [
        'https://github.com/0xTanzim',
        'https://www.linkedin.com/in/0xtanzim/',
        'https://x.com/0xTanzim',
      ],
    },
  },
  paths: {
    docs: '/docs',
    llmTxt: '/llm.txt',
    llmsTxt: '/llms.txt',
    llmsFullTxt: '/llms-full.txt',
    skillsJson: '/skills.json',
    mcpJson: '/mcp.json',
    agentSpecJson: '/agent-spec.json',
    markdownApiPrefix: '/api/mdx',
  },
  llms: {
    summary:
      'A minimal, modular Node.js backend framework with zero runtime dependencies in core packages.',
    intro:
      'NextRush v3 is a TypeScript-first framework in a modular monorepo. It supports functional routes and class-based controllers with DI. The core stays small (under 3,000 LOC); throughput depends on your hardware — see the Performance docs for reproducible benchmarks.',
    sectionTitles: {
      'getting-started': 'Getting Started',
      concepts: 'Core Concepts',
      guides: 'Guides',
      examples: 'Examples',
      'api-reference': 'API Reference',
      performance: 'Performance',
      community: 'Community',
    },
  },
} as const;

export function toAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${appConfig.siteUrl}${normalizedPath}`;
}

export const appEndpoints = {
  docs: toAbsoluteUrl(appConfig.paths.docs),
  llmTxt: toAbsoluteUrl(appConfig.paths.llmTxt),
  llmsTxt: toAbsoluteUrl(appConfig.paths.llmsTxt),
  llmsFullTxt: toAbsoluteUrl(appConfig.paths.llmsFullTxt),
  skillsJson: toAbsoluteUrl(appConfig.paths.skillsJson),
  mcpJson: toAbsoluteUrl(appConfig.paths.mcpJson),
  agentSpecJson: toAbsoluteUrl(appConfig.paths.agentSpecJson),
} as const;
