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
  fastify: {
    name: 'Fastify',
    file: 'fastify.js',
    description: 'Fastify 5.x — logger disabled, default config',
  },
  express: {
    name: 'Express',
    file: 'express.js',
    description: 'Express 5.x — minimal middleware',
  },
  koa: {
    name: 'Koa',
    file: 'koa.js',
    description: 'Koa 3.x with koa-router and koa-bodyparser',
  },
  hono: {
    name: 'Hono',
    file: 'hono.js',
    description: 'Hono 4.x via @hono/node-server',
  },
};

export const DEFAULT_FRAMEWORKS = ['raw-node', 'nextrush-v3', 'fastify', 'express', 'koa', 'hono'];
