/**
 * @nextrush/types - Standard Schema Contract
 *
 * Structural copy of the `@standard-schema/spec` v1 interface
 * (https://github.com/standard-schema/standard-schema, MIT licensed), vendored
 * as a type so NextRush stays dependency-free. It lives in `@nextrush/types`
 * (not in any single consumer) because it is now a shared contract: request
 * validation, route metadata, and OpenAPI generation all reference it.
 *
 * Because TypeScript is structural, any schema implementing Standard Schema —
 * Zod 3.24+, Valibot 1.0+, ArkType 2.0+, and others — satisfies this interface
 * without an adapter.
 *
 * @packageDocumentation
 */

/**
 * A schema that exposes the Standard Schema v1 contract on its `~standard`
 * property. This is the only surface NextRush depends on.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaProps<Input, Output>;
}

/** The `~standard` property contract. */
export interface StandardSchemaProps<Input = unknown, Output = Input> {
  /** Spec version — always `1`. */
  readonly version: 1;
  /** Identifier of the schema library (e.g. `'zod'`, `'valibot'`). */
  readonly vendor: string;
  /** Validates and (optionally) coerces `value`; may be sync or async. */
  readonly validate: (
    value: unknown
  ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  /** Phantom types for input/output inference; never present at runtime. */
  readonly types?: { readonly input: Input; readonly output: Output } | undefined;
}

/** Result of a validation: either a success carrying `value`, or a failure carrying `issues`. */
export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly StandardSchemaIssue[] };

/** A single validation issue reported by a schema. */
export interface StandardSchemaIssue {
  /** Human-readable message. */
  readonly message: string;
  /** Path to the offending value; segments are keys or `{ key }` objects. */
  readonly path?: readonly (PropertyKey | StandardSchemaPathSegment)[] | undefined;
}

/** A structured path segment. */
export interface StandardSchemaPathSegment {
  readonly key: PropertyKey;
}

/** Infer the validated output type of a Standard Schema. */
export type InferOutput<S extends StandardSchemaV1> = NonNullable<
  S['~standard']['types']
>['output'];
