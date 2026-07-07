import type { RouteDefinition, StandardSchemaV1 } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { extractPathParams, generateDocument, toOpenApiPath } from '../generate.js';
import type { SchemaConverter } from '../types.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A schema carrying its intended JSON schema, for a deterministic converter. */
function schemaWith(json: unknown): StandardSchemaV1 {
  return {
    '~standard': { version: 1, vendor: 'test', validate: () => ({ value: {} }) },
    __json: json,
  } as unknown as StandardSchemaV1;
}
const convert: SchemaConverter = (s) => (s as { __json?: unknown }).__json ?? {};

function route(
  def: Partial<RouteDefinition> & Pick<RouteDefinition, 'method' | 'path'>
): RouteDefinition {
  return { key: `${def.method} ${def.path}`, ...def };
}

describe('toOpenApiPath / extractPathParams', () => {
  it('converts :param to {param}', () => {
    expect(toOpenApiPath('/users/:id/posts/:postId')).toBe('/users/{id}/posts/{postId}');
  });
  it('extracts path param names', () => {
    expect(extractPathParams('/users/:id/posts/:postId')).toEqual(['id', 'postId']);
  });
});

describe('generateDocument', () => {
  it('produces a valid empty 3.1 doc with default info', async () => {
    const doc = await generateDocument([], {});
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toEqual({ title: 'API', version: '1.0.0' });
    expect(doc.paths).toEqual({});
  });

  it('applies info overrides', async () => {
    const doc = await generateDocument([], {
      info: { title: 'My API', version: '2.0.0', description: 'x' },
    });
    expect(doc.info).toEqual({ title: 'My API', version: '2.0.0', description: 'x' });
  });

  it('adds a path + operation with operationId and default responses', async () => {
    const doc = await generateDocument([route({ method: 'GET', path: '/health' })], {});
    const paths = doc.paths as Record<string, any>;
    expect(paths['/health'].get.operationId).toBe('get_health');
    expect(paths['/health'].get.responses).toEqual({ default: { description: 'Response' } });
  });

  it('converts path params and emits path parameters', async () => {
    const doc = await generateDocument([route({ method: 'GET', path: '/users/:id' })], {});
    const paths = doc.paths as Record<string, any>;
    expect(paths['/users/{id}']).toBeDefined();
    expect(paths['/users/{id}'].get.parameters).toContainEqual({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  });

  it('emits requestBody from request.body', async () => {
    const body = schemaWith({ type: 'object', properties: { name: { type: 'string' } } });
    const doc = await generateDocument(
      [route({ method: 'POST', path: '/users', metadata: { request: { body } } })],
      { toJsonSchema: convert }
    );
    const paths = doc.paths as Record<string, any>;
    expect(paths['/users'].post.requestBody.content['application/json'].schema).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
    });
  });

  it('decomposes request.query into query parameters', async () => {
    const query = schemaWith({
      type: 'object',
      properties: { q: { type: 'string' }, page: { type: 'number' } },
      required: ['q'],
    });
    const doc = await generateDocument(
      [route({ method: 'GET', path: '/search', metadata: { request: { query } } })],
      { toJsonSchema: convert }
    );
    const params = (doc.paths as Record<string, any>)['/search'].get.parameters;
    expect(params).toContainEqual({ name: 'q', in: 'query', required: true, schema: { type: 'string' } });
    expect(params).toContainEqual({
      name: 'page',
      in: 'query',
      required: false,
      schema: { type: 'number' },
    });
  });

  it('emits responses with description + content', async () => {
    const res = schemaWith({ type: 'object' });
    const doc = await generateDocument(
      [route({ method: 'POST', path: '/users', metadata: { responses: { 201: res } } })],
      { toJsonSchema: convert }
    );
    const responses = (doc.paths as Record<string, any>)['/users'].post.responses;
    expect(responses['201']).toEqual({
      description: 'Created',
      content: { 'application/json': { schema: { type: 'object' } } },
    });
  });

  it('carries summary/description/tags/deprecated', async () => {
    const doc = await generateDocument(
      [
        route({
          method: 'GET',
          path: '/x',
          metadata: { summary: 'S', description: 'D', tags: ['t'], deprecated: true },
        }),
      ],
      {}
    );
    const op = (doc.paths as Record<string, any>)['/x'].get;
    expect(op.summary).toBe('S');
    expect(op.tags).toEqual(['t']);
    expect(op.deprecated).toBe(true);
  });

  it('skips visibility:internal routes', async () => {
    const doc = await generateDocument(
      [
        route({ method: 'GET', path: '/secret', metadata: { visibility: 'internal' } }),
        route({ method: 'GET', path: '/public' }),
      ],
      {}
    );
    const paths = doc.paths as Record<string, any>;
    expect(paths['/secret']).toBeUndefined();
    expect(paths['/public']).toBeDefined();
  });

  it('skips excluded path prefixes', async () => {
    const doc = await generateDocument(
      [
        route({ method: 'GET', path: '/internal/metrics' }),
        route({ method: 'GET', path: '/public' }),
      ],
      { exclude: ['/internal'] }
    );
    const paths = doc.paths as Record<string, any>;
    expect(paths['/internal/metrics']).toBeUndefined();
    expect(paths['/public']).toBeDefined();
  });
});
