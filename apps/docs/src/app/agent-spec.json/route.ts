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
      responsibility: 'Shared TypeScript types — Context, Middleware, Plugin, Router interfaces',
      doc_url: toAbsoluteUrl('/docs/packages/types/types'),
      public_api: ['ContentType', 'HttpStatus', 'HTTP_METHODS'],
    },
    {
      name: '@nextrush/errors',
      responsibility: 'HTTP error hierarchy with proper status codes and factory functions',
      doc_url: toAbsoluteUrl('/docs/packages/errors/errors'),
      public_api: [
        'HttpError',
        'BadRequestError',
        'NotFoundError',
        'UnauthorizedError',
        'ForbiddenError',
        'ValidationError',
        'errorHandler',
        'notFoundHandler',
        'catchAsync',
        'createError',
      ],
    },
    {
      name: '@nextrush/core',
      responsibility: 'Application lifecycle, middleware composition, plugin system',
      doc_url: toAbsoluteUrl('/docs/packages/core/core'),
      public_api: ['createApp', 'Application', 'compose', 'flattenMiddleware'],
    },
    {
      name: '@nextrush/router',
      responsibility: 'Radix tree routing with parameterized and wildcard routes',
      doc_url: toAbsoluteUrl('/docs/packages/router/router'),
      public_api: ['createRouter', 'Router'],
    },
    {
      name: '@nextrush/di',
      responsibility: 'Dependency injection container wrapping tsyringe',
      doc_url: toAbsoluteUrl('/docs/packages/di/di'),
      public_api: ['container', 'createContainer', 'Service', 'Repository', 'inject'],
    },
    {
      name: '@nextrush/decorators',
      responsibility: 'Controller, route, parameter, and guard decorators',
      doc_url: toAbsoluteUrl('/docs/packages/decorators/decorators'),
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
      ],
    },
    {
      name: '@nextrush/controllers',
      responsibility: 'Auto-discovery and handler building for decorator-based controllers',
      doc_url: toAbsoluteUrl('/docs/packages/controllers/controllers'),
      public_api: [
        'controllersPlugin',
        'ControllersPlugin',
        'registerController',
        'discoverControllers',
      ],
    },
    {
      name: '@nextrush/adapter-node',
      responsibility: 'Node.js HTTP adapter for NextRush applications',
      doc_url: toAbsoluteUrl('/docs/packages/adapters/adapter-node'),
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
