import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

const AGENT_SPEC = {
  name: 'nextrush',
  version: '3.0.0-alpha.2',
  description: 'Minimal, modular, high-performance Node.js framework',
  homepage: 'https://nextrush.dev',
  repository: 'https://github.com/0xTanzim/nextrush',
  docs: {
    base_url: 'https://nextrush.dev/docs',
    llms_txt: 'https://nextrush.dev/llms.txt',
    llms_full: 'https://nextrush.dev/llms-full.txt',
    skills: 'https://nextrush.dev/skills.json',
  },
  packages: [
    {
      name: '@nextrush/types',
      responsibility: 'Shared TypeScript types — Context, Middleware, Plugin, Router interfaces',
      doc_url: 'https://nextrush.dev/docs/packages/types/types',
      public_api: ['ContentType', 'HttpStatus', 'HTTP_METHODS'],
    },
    {
      name: '@nextrush/errors',
      responsibility: 'HTTP error hierarchy with proper status codes and factory functions',
      doc_url: 'https://nextrush.dev/docs/packages/errors/errors',
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
      doc_url: 'https://nextrush.dev/docs/packages/core/core',
      public_api: ['createApp', 'Application', 'compose', 'flattenMiddleware'],
    },
    {
      name: '@nextrush/router',
      responsibility: 'High-performance radix tree routing with parameterized and wildcard routes',
      doc_url: 'https://nextrush.dev/docs/packages/router/router',
      public_api: ['createRouter', 'Router'],
    },
    {
      name: '@nextrush/di',
      responsibility: 'Dependency injection container wrapping tsyringe',
      doc_url: 'https://nextrush.dev/docs/packages/di/di',
      public_api: ['container', 'createContainer', 'Service', 'Repository', 'inject'],
    },
    {
      name: '@nextrush/decorators',
      responsibility: 'Controller, route, parameter, and guard decorators',
      doc_url: 'https://nextrush.dev/docs/packages/decorators/decorators',
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
      doc_url: 'https://nextrush.dev/docs/packages/controllers/controllers',
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
      doc_url: 'https://nextrush.dev/docs/packages/adapters/adapter-node',
      public_api: ['createNodeAdapter'],
    },
  ],
  constraints: [
    'Zero external runtime dependencies (except reflect-metadata for DI)',
    'TypeScript strict mode — zero any usage',
    'Node.js >= 22.0.0',
    'Target 30,000+ RPS',
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
