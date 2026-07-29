import { appConfig, appEndpoints, toAbsoluteUrl } from '@/config/appConfig';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

const AGENT_SPEC = {
  name: appConfig.id,
  version: appConfig.version,
  description: 'Minimal, modular TypeScript HTTP framework for Node.js and other runtimes',
  homepage: appConfig.siteUrl,
  repository: appConfig.repositoryUrl,
  docs: {
    base_url: appEndpoints.docs,
    llm_txt: appEndpoints.llmTxt,
    llms_txt: appEndpoints.llmsTxt,
    llms_full: appEndpoints.llmsFullTxt,
    skills: appEndpoints.skillsJson,
  },
  packages: [
    {
      name: '@nextrush/types',
      responsibility: 'Shared TypeScript types — Context, Middleware, Extension, Router interfaces',
      doc_url: toAbsoluteUrl('/docs/reference/types'),
      public_api: ['ContentType', 'HttpStatus', 'HTTP_METHODS'],
    },
    {
      name: '@nextrush/errors',
      responsibility: 'HTTP error hierarchy with proper status codes and factory functions',
      doc_url: toAbsoluteUrl('/docs/reference/errors'),
      public_api: [
        'HttpError',
        'BadRequestError',
        'NotFoundError',
        'UnauthorizedError',
        'ForbiddenError',
        'ValidationError',
        'errorHandler',
        'notFoundHandler',
        'createError',
      ],
    },
    {
      name: '@nextrush/core',
      responsibility: 'Application lifecycle, middleware composition, plugin system',
      doc_url: toAbsoluteUrl('/docs/reference/core'),
      public_api: ['createApp', 'Application', 'compose', 'flattenMiddleware'],
    },
    {
      name: '@nextrush/router',
      responsibility: 'Segment trie routing with O(k) lookup, parameterized and wildcard routes',
      doc_url: toAbsoluteUrl('/docs/reference/router'),
      public_api: ['createRouter', 'Router'],
    },
    {
      name: '@nextrush/class',
      responsibility:
        'Unified class runtime — decorators, DI, controllers, modules, guards, interceptors, filters, lifecycle. Consolidates the former @nextrush/decorators and @nextrush/controllers packages (removed) and re-exports @nextrush/di.',
      doc_url: toAbsoluteUrl('/docs/reference/class'),
      public_api: [
        'Controller',
        'Get',
        'Post',
        'Put',
        'Delete',
        'Patch',
        'Body',
        'Param',
        'Query',
        'Header',
        'Ctx',
        'UseGuard',
        'Module',
        'registerModule',
        'registerControllers',
      ],
    },
    {
      name: '@nextrush/di',
      responsibility: 'Dependency injection container wrapping tsyringe',
      doc_url: toAbsoluteUrl('/docs/reference/class/di'),
      public_api: ['container', 'createContainer', 'Service', 'Repository', 'inject'],
    },
    {
      name: '@nextrush/adapter-node',
      responsibility: 'Node.js HTTP adapter for NextRush applications',
      doc_url: toAbsoluteUrl('/docs/reference/platforms/node'),
      public_api: ['createNodeAdapter'],
    },
  ],
  constraints: [
    'Zero external runtime dependencies (except reflect-metadata for DI)',
    'TypeScript strict mode — zero any usage',
    'Node.js >= 22.0.0',
    'Benchmark on target hardware before relying on throughput claims',
    'Core under 3,000 LOC',
  ],
  paradigms: ['functional', 'class-based'],
  context_api: {
    input: [
      'ctx.body',
      'ctx.query',
      'ctx.params',
      'ctx.headers',
      'ctx.method',
      'ctx.path',
      'ctx.state',
    ],
    output: ['ctx.json()', 'ctx.send()', 'ctx.html()', 'ctx.redirect()'],
    middleware: ['ctx.next()'],
  },
};

export function GET() {
  return NextResponse.json(AGENT_SPEC, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
