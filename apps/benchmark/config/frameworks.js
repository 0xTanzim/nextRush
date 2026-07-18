/** Framework definitions for benchmarking */

export const FRAMEWORKS = {
  'raw-node': {
    name: 'Raw Node.js',
    file: 'raw-node.js',
    description: 'Bare http.createServer — zero framework overhead baseline',
    isBaseline: true,
  },
  'nextrush-v3': {
    name: 'NextRush v3',
    file: 'nextrush-v3.js',
    description: 'NextRush v3 with router + conditional body parser',
    isTarget: true,
  },
  'nextrush-v3-class': {
    name: 'NextRush v3 (class)',
    file: 'nextrush-v3-class.js',
    description: 'NextRush v3 class/DI path — @Controller + registerControllers()',
    isTarget: true,
  },
  fastify: {
    name: 'Fastify',
    file: 'fastify.js',
    description: 'Fastify 5.x — logger disabled, default config',
  },
  hono: {
    name: 'Hono',
    file: 'hono.js',
    description: 'Hono 4.x via @hono/node-server',
  },
  koa: {
    name: 'Koa',
    file: 'koa.js',
    description: 'Koa 3.x with koa-router and koa-bodyparser',
  },
  express: {
    name: 'Express',
    file: 'express.js',
    description: 'Express 5.x — minimal middleware',
  },
};

export const DEFAULT_FRAMEWORKS = ['raw-node', 'nextrush-v3', 'fastify', 'hono', 'koa', 'express'];
