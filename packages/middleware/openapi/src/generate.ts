/**
 * @nextrush/openapi - Document generator
 *
 * Pure transform: RouteDefinition[] -> OpenAPI 3.1 document. No I/O, no router
 * coupling — the middleware (middleware.ts) feeds it getRoutes() and caches the result.
 */

import type { RouteDefinition, StandardSchemaV1 } from '@nextrush/types';
import { resolveConverter } from './json-schema.js';
import type { OpenApiDocument, OpenApiOptions, SchemaConverter } from './types.js';

/** Convert a NextRush path pattern (`/users/:id`) to an OpenAPI path (`/users/{id}`). */
export function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/** Extract path parameter names from a NextRush path pattern. */
export function extractPathParams(path: string): string[] {
  const names: string[] = [];
  const re = /:([A-Za-z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    if (m[1]) names.push(m[1]);
  }
  return names;
}

function isExcluded(path: string, exclude: readonly string[] | undefined): boolean {
  if (!exclude) return false;
  return exclude.some((prefix) => path.startsWith(prefix));
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

/** Decompose an object JSON Schema into { name, schema, required } entries. */
function objectProps(
  schema: unknown
): { name: string; schema: unknown; required: boolean }[] {
  const obj = asObject(schema);
  if (!obj) return [];
  const props = asObject(obj.properties);
  if (!props) return [];
  const requiredList = Array.isArray(obj.required) ? (obj.required as unknown[]) : [];
  const required = new Set(requiredList.filter((x): x is string => typeof x === 'string'));
  return Object.keys(props).map((name) => ({
    name,
    schema: props[name],
    required: required.has(name),
  }));
}

function propSchema(schema: unknown, name: string): unknown {
  const props = asObject(asObject(schema)?.properties);
  return props?.[name];
}

const STATUS_TEXT: Readonly<Record<number, string>> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/**
 * Every OpenAPI-representable HTTP method key, in a stable rendering order —
 * used to expand a single `isAnyMethod` route (T016) into one operation per
 * verb, matching how `@All()`/`router.all()` actually registers the route
 * (one handler answering every standard method) rather than the single
 * placeholder `method` value the row's `RouteDefinition.method` field carries
 * for structural compatibility with ordinary single-method rows.
 */
const ALL_OPENAPI_VERBS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;

function deriveOperationId(route: RouteDefinition, verb: string): string {
  const slug = route.path.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${verb}${slug ? `_${slug}` : ''}`;
}

async function buildResponses(
  responses: Readonly<Record<number, StandardSchemaV1>> | undefined,
  convert: SchemaConverter
): Promise<Record<string, unknown>> {
  if (!responses) {
    return { default: { description: 'Response' } };
  }
  const out: Record<string, unknown> = {};
  for (const [status, schema] of Object.entries(responses)) {
    const code = Number(status);
    out[status] = {
      description: STATUS_TEXT[code] ?? 'Response',
      content: { 'application/json': { schema: await convert(schema) } },
    };
  }
  return out;
}

async function buildOperation(
  route: RouteDefinition,
  verb: string,
  convert: SchemaConverter
): Promise<Record<string, unknown>> {
  const md = route.metadata;
  const op: Record<string, unknown> = { operationId: deriveOperationId(route, verb) };

  if (md?.summary) op.summary = md.summary;
  if (md?.description) op.description = md.description;
  if (md?.tags) op.tags = md.tags;
  if (md?.deprecated) op.deprecated = true;

  const parameters: unknown[] = [];

  const paramsSchema = md?.request?.params ? await convert(md.request.params) : undefined;
  for (const name of extractPathParams(route.path)) {
    parameters.push({
      name,
      in: 'path',
      required: true,
      schema: propSchema(paramsSchema, name) ?? { type: 'string' },
    });
  }

  if (md?.request?.query) {
    const querySchema = await convert(md.request.query);
    for (const p of objectProps(querySchema)) {
      parameters.push({ name: p.name, in: 'query', required: p.required, schema: p.schema });
    }
  }

  if (parameters.length > 0) op.parameters = parameters;

  if (md?.request?.body) {
    op.requestBody = {
      required: true,
      content: { 'application/json': { schema: await convert(md.request.body) } },
    };
  }

  op.responses = await buildResponses(md?.responses, convert);
  return op;
}

/**
 * Generate an OpenAPI 3.1 document from route definitions. Routes marked
 * `visibility: 'internal'` or matching an `exclude` prefix are omitted.
 */
export async function generateDocument(
  routes: readonly RouteDefinition[],
  options: Pick<OpenApiOptions, 'info' | 'exclude' | 'toJsonSchema'>
): Promise<OpenApiDocument> {
  const convert = resolveConverter(options.toJsonSchema);
  const info: Record<string, unknown> = {
    title: options.info?.title ?? 'API',
    version: options.info?.version ?? '1.0.0',
  };
  if (options.info?.description) info.description = options.info.description;

  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    if (route.metadata?.visibility === 'internal') continue;
    if (isExcluded(route.path, options.exclude)) continue;

    const oaPath = toOpenApiPath(route.path);
    const pathItem = (paths[oaPath] ??= {});

    // An isAnyMethod row (T016) represents one handler answering every
    // standard HTTP method — expand it into an operation per verb rather
    // than keying off its single placeholder `.method` value, which would
    // silently drop the other 6 methods from the generated spec.
    const verbs = route.isAnyMethod ? ALL_OPENAPI_VERBS : [route.method.toLowerCase()];
    for (const verb of verbs) {
      pathItem[verb] = await buildOperation(route, verb, convert);
    }
  }

  return { openapi: '3.1.0', info, paths };
}
