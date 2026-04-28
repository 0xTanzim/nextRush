const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://github.com/0xTanzim/nextRush';

export const appConfig = {
  name: 'NextRush',
  id: 'nextrush',
  version: '3.0.4',
  teamName: 'NextRush Team',
  twitterHandle: '@nextrush',
  siteUrl: SITE_URL,
  repositoryUrl: 'https://github.com/0xTanzim/nextRush',
  /** Canonical folder for Agent Skills source in the repo (`skills/<name>/SKILL.md`). */
  skillsSourceRootUrl: 'https://github.com/0xTanzim/nextRush/tree/main/skills',
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
      architecture: 'Architecture',
      packages: 'Packages',
      guides: 'Guides',
      examples: 'Examples',
      benchmarks: 'Benchmarks',
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
