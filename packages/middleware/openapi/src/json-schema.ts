/**
 * @nextrush/openapi - Standard Schema → JSON Schema conversion
 *
 * No universal Standard-Schema converter exists yet, so we vendor-dispatch on
 * `~standard.vendor` to the schema library's own converter (loaded via a
 * variable dynamic import so it is never bundled and its absence is tolerated),
 * with a user override and an untyped `{}` fallback.
 */

import type { StandardSchemaV1 } from '@nextrush/types';
import type { SchemaConverter } from './types.js';

/** Free-function converters exported by a library's converter package. */
const FREE_FN_CONVERTERS: Readonly<Record<string, { specifier: string; fn: string }>> = {
  zod: { specifier: 'zod', fn: 'toJSONSchema' },
  valibot: { specifier: '@valibot/to-json-schema', fn: 'toJsonSchema' },
};

function extractFn(mod: unknown, name: string): ((arg: unknown) => unknown) | undefined {
  if (mod && typeof mod === 'object' && name in mod) {
    const candidate = (mod as Record<string, unknown>)[name];
    if (typeof candidate === 'function') return candidate as (arg: unknown) => unknown;
  }
  return undefined;
}

/**
 * Default converter: dispatch on the schema's vendor. Returns `{}` (untyped)
 * when the vendor is unknown or its converter package isn't installed —
 * generation never fails on a schema it can't convert.
 */
export async function defaultConvert(schema: StandardSchemaV1): Promise<unknown> {
  const vendor = schema['~standard'].vendor;

  try {
    // ArkType exposes `.toJsonSchema()` as a method on the schema itself.
    if (vendor === 'arktype') {
      const method = extractFn(schema, 'toJsonSchema');
      if (method) return (schema as unknown as { toJsonSchema(): unknown }).toJsonSchema();
      return {};
    }

    const entry = FREE_FN_CONVERTERS[vendor];
    if (entry) {
      // Variable specifier → not statically bundled; absence throws → caught.
      const mod: unknown = await import(entry.specifier);
      const convert = extractFn(mod, entry.fn);
      if (convert) return convert(schema);
    }
  } catch {
    // Optional converter package not installed — fall through to untyped.
  }

  return {};
}

/** Resolve the converter to use (user override wins). */
export function resolveConverter(override?: SchemaConverter): SchemaConverter {
  return override ?? defaultConvert;
}
