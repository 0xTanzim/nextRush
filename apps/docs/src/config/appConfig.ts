const SITE_URL = 'https://nextrush.dev';

export const appConfig = {
  name: 'NextRush',
  id: 'nextrush',
  version: '3.0.0-alpha.2',
  teamName: 'NextRush Team',
  twitterHandle: '@nextrush',
  siteUrl: SITE_URL,
  repositoryUrl: 'https://github.com/0xTanzim/nextrush',
  skillsRepoBaseUrl: 'https://github.com/0xTanzim/nextrush/tree/feat/v3-dev2/.github/skills',
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
      'A minimal, modular, high-performance Node.js backend framework with zero runtime dependencies.',
    intro:
      'NextRush v3 is a TypeScript-first framework built as a modular monorepo. It supports both functional and class-based (decorator + DI) paradigms, targets 30,000+ RPS, and ships under 3,000 LOC in its core.',
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
