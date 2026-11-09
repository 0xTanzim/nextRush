/**
 * @nextrush/validation - Validation Middleware
 *
 * `validate()` is the one public entry point. Pass a schema to validate the
 * request body, or a `{ body, query, params }` map to validate several parts
 * at once. On success the coerced body replaces `ctx.body`, and every coerced
 * target is exposed on `ctx.state.validated` (read it with `validated(ctx)`);
 * `ctx.query` and `ctx.params` are validated but left unmodified so their
 * declared string-map types stay honest (see the package README §5).
 * On failure it throws the framework's existing `ValidationError`, aggregating
 * every issue across every target.
 */

import { ValidationError, type ValidationIssue } from '@nextrush/errors';
import type { Context, Middleware, Next } from '@nextrush/types';
import { ROUTE_METADATA, type MetadataContribution } from '@nextrush/types';
import { runSchema } from './run-schema.js';
import type { StandardSchemaV1 } from '@nextrush/types';
import type { RequestSchemas, ValidateOptions, ValidatedAccessor, ValidatedInput, ValidationTarget } from './types.js';

/**
 * The `ctx.state` key holding the coerced values. Exported only so `validated()`
 * and the tests share one definition; it is not part of the public barrel.
 */
const VALIDATED_STATE_KEY = 'validated';

/**
 * Create request-validation middleware.
 *
 * Pass a schema to validate the request **body**, or a `{ body, query, params }`
 * map to validate several parts at once. On success the coerced body replaces
 * `ctx.body` and every coerced target is exposed on `ctx.state.validated`
 * (read it with {@link validated}); `ctx.query` and `ctx.params` are validated
 * but intentionally left unmodified (see the package README). On failure it
 * throws the framework's existing `ValidationError`, aggregating every issue
 * across every target.
 *
 * @param arg - A Standard Schema (validates the body) or a per-target schema map.
 * @param options - Optional settings; `errorStatus` overrides the failure status.
 *
 * @example
 * ```ts
 * const Query = z.object({ limit: z.coerce.number().int().min(1).default(50) });
 *
 * app.get('/items', validate({ query: Query }, { errorStatus: 422 }), (ctx) => {
 *   const { query } = validated(ctx);  // { limit: number }
 *   ctx.json({ limit: query.limit });
 * });
 * ```
 */
export function validate(
  arg: StandardSchemaV1 | RequestSchemas,
  options: ValidateOptions = {}
): Middleware {
  const schemas = normalizeSchemas(arg);
  const errorStatus = options.errorStatus ?? 400;

  assertValidErrorStatus(errorStatus);

  const middleware: Middleware = async (ctx: Context, next: Next): Promise<void> => {
    const issues: ValidationIssue[] = [];
    let anyFailed = false;
    let coercedBody: unknown;
    let bodyValidated = false;
    let coercedQuery: unknown;
    let queryValidated = false;
    let coercedParams: unknown;
    let paramsValidated = false;

    // Validate every target before mutating anything, so a later failure never
    // leaves ctx.body half-updated (atomic).
    if (schemas.body) {
      // A body schema must consume the body explicitly: under lazy parsing
      // (RFC-047) `ctx.body` throws until `readBody()` resolves. In eager mode
      // this resolves from the already-parsed value.
      const source = await ctx.readBody();

      // Without a body parser installed, `readBody()` resolves to `undefined`
      // even for a request that clearly carries a body. Reporting that as
      // "expected object, received undefined" sends the developer hunting for a
      // schema bug when the real cause is a missing `bodyParser()`. Name the
      // actual cause instead.
      if (source === undefined && hasUnparsedBody(ctx)) {
        throw new Error(
          'validate(): the request has a body but ctx.readBody() resolved to undefined. ' +
            'A body schema requires a body parser — install one before this middleware, ' +
            "e.g. `app.use(bodyParser())` from '@nextrush/body-parser'."
        );
      }

      const outcome = await check(schemas.body, source, 'body', issues);
      if (outcome.ok) {
        coercedBody = outcome.value;
        bodyValidated = true;
      } else {
        anyFailed = true;
      }
    }
    if (schemas.query) {
      const outcome = await check(schemas.query, ctx.query, 'query', issues);
      if (outcome.ok) {
        coercedQuery = outcome.value;
        queryValidated = true;
      } else {
        anyFailed = true;
      }
    }
    if (schemas.params) {
      const outcome = await check(schemas.params, ctx.params, 'params', issues);
      if (outcome.ok) {
        coercedParams = outcome.value;
        paramsValidated = true;
      } else {
        anyFailed = true;
      }
    }

    // Track failure explicitly rather than via `issues.length`: a schema that
    // signals failure with an empty issues array must still reject, never pass
    // silently.
    if (anyFailed) {
      throw new ValidationError(issues, 'Validation failed', errorStatus);
    }

    if (bodyValidated) {
      ctx.body = coercedBody;
    }

    // Expose the coerced values for every configured target. `ctx.query` and
    // `ctx.params` are NOT written back: they are declared as string maps, so a
    // coerced number there would make TypeScript disagree with the runtime.
    // `ctx.state` is `unknown`-valued, so storing the coerced objects is honest.
    //
    // Merge with anything an earlier `validate()` on the same route already
    // stored, so stacking `validate({ params })` then `validate({ query })`
    // keeps both instead of the second silently clobbering the first.
    const state = ((ctx as { state?: Record<string, unknown> }).state ??= {});
    const previous = state[VALIDATED_STATE_KEY];
    const validatedInput: ValidatedInput =
      previous !== null && typeof previous === 'object' ? { ...previous } : {};
    if (bodyValidated) validatedInput.body = coercedBody;
    if (queryValidated) validatedInput.query = coercedQuery;
    if (paramsValidated) validatedInput.params = coercedParams;
    state[VALIDATED_STATE_KEY] = validatedInput;

    await next();
  };

  // Contribute the request schemas to the route metadata system, read by
  // @nextrush/router at registration (and thus by @nextrush/openapi). This is a
  // non-enumerable, internal marker — validate()'s public API is unchanged.
  Object.defineProperty(middleware, ROUTE_METADATA, {
    value: { request: schemas } satisfies MetadataContribution,
    enumerable: false,
  });

  return middleware;
}

/**
 * Create a reusable `validate` middleware preconfigured with default options.
 *
 * @param defaultOptions - Default validation settings applied to every route, e.g. `{ errorStatus: 422 }`.
 * @returns A configured `validate` function with identical signature to {@link validate}.
 *
 * @example
 * ```ts
 * // Configure project-wide validation once:
 * export const validate = createValidate({ errorStatus: 422 });
 *
 * // Use across all routers without repeating errorStatus:
 * app.get('/items', validate({ query: QuerySchema }), handler);
 * ```
 */
export function createValidate(defaultOptions: ValidateOptions = {}): typeof validate {
  if (defaultOptions.errorStatus !== undefined) {
    assertValidErrorStatus(defaultOptions.errorStatus);
  }

  return function configuredValidate(
    arg: StandardSchemaV1 | RequestSchemas,
    options?: ValidateOptions
  ): Middleware {
    return validate(arg, options ? { ...defaultOptions, ...options } : defaultOptions);
  };
}

function getValidated(ctx: Context): ValidatedInput {
  const state = (ctx as { state?: Record<string, unknown> } | undefined)?.state;
  const stored = state?.[VALIDATED_STATE_KEY];
  if (stored === null || typeof stored !== 'object') return {};
  return stored;
}

/**
 * Read the coerced values produced by {@link validate}.
 *
 * @param ctx - The request context.
 * @returns The coerced targets, or an empty object when no `validate()` ran.
 *
 * @remarks
 * `ctx.state` is `unknown`-valued, so this is the cast-free way to reach the
 * coerced values. An empty object (rather than `undefined`) is returned when
 * validation did not run, so a destructure never throws.
 *
 * Can be typed via type parameters or target-specific helpers (`validated.query(ctx)`):
 *
 * @example
 * ```ts
 * const { query } = validated<{ query: { limit: number } }>(ctx);
 * const query = validated.query<{ limit: number }>(ctx);
 * ```
 */
export const validated: ValidatedAccessor = Object.assign(
  (ctx: Context) => getValidated(ctx),
  {
    query: (ctx: Context) => getValidated(ctx).query,
    params: (ctx: Context) => getValidated(ctx).params,
    body: (ctx: Context) => getValidated(ctx).body,
  }
) as unknown as ValidatedAccessor;

/**
 * Ensure `errorStatus` is an integer between 400 and 499.
 *
 * @remarks
 * Fail fast at construction, not at request time. An out-of-range status
 * reaches `res.writeHead()`, which throws ERR_HTTP_INVALID_STATUS_CODE
 * asynchronously — that is an uncaught exception that takes down the whole
 * process, so a config typo would become a remote DoS on the first bad
 * request. Rejecting it here surfaces the mistake at startup instead.
 *
 * Bounded to 4xx on purpose: a validation failure is the client's fault, so
 * reporting it as a 5xx would both mislabel the fault and contradict this
 * framework's own rule that a 5xx never exposes its details (`base.ts`:
 * `expose = status < 500`). `ValidationError` sets `expose: true`, so a 5xx
 * here would leak every issue while claiming the server broke.
 */
function assertValidErrorStatus(errorStatus: number): void {
  if (!Number.isInteger(errorStatus) || errorStatus < 400 || errorStatus > 499) {
    throw new RangeError(
      `validate(): errorStatus must be an integer between 400 and 499 ` +
        `(a validation failure is a client error, never a success or a server fault). ` +
        `Received: ${String(errorStatus)}.`
    );
  }
}

type CheckResult = { ok: true; value: unknown } | { ok: false };

/**
 * Run one schema and accumulate any validation issues rather than throwing
 * immediately, so issues from all targets aggregate into a single error.
 * A non-validation error (a schema whose `validate()` itself throws) is
 * unexpected and propagates untouched — it is not swallowed into the 400.
 */
async function check(
  schema: StandardSchemaV1,
  value: unknown,
  target: ValidationTarget,
  issues: ValidationIssue[]
): Promise<CheckResult> {
  try {
    const validated = await runSchema(schema, value, target);
    return { ok: true, value: validated };
  } catch (err) {
    if (err instanceof ValidationError) {
      issues.push(...err.issues);
      return { ok: false };
    }
    throw err;
  }
}

/**
 * Whether the request advertises a body that `readBody()` did not return.
 *
 * @remarks
 * Used only to tell "the client sent nothing" apart from "no body parser is
 * installed", so the error names the real cause. A `content-length: 0` or a
 * missing content type means there is genuinely nothing to parse, and the
 * schema's own "required" error is the correct message for that.
 */
function hasUnparsedBody(ctx: Context): boolean {
  const contentLength = ctx.get('content-length');
  if (contentLength !== undefined) {
    const length = Number(contentLength);
    if (Number.isFinite(length) && length > 0) return true;
  }
  const transferEncoding = ctx.get('transfer-encoding');
  if (transferEncoding !== undefined && transferEncoding.length > 0) return true;
  return false;
}

/** The only keys a schema map may carry. */
const VALID_TARGETS: readonly string[] = ['body', 'query', 'params'];

/**
 * Normalize `validate()`'s first argument and reject the mistakes that would
 * otherwise fail silently.
 *
 * @remarks
 * Two user errors are indistinguishable from "validate nothing" at runtime and
 * are therefore caught here, at construction:
 *
 * - **A misspelled target key.** `validate({ querys: Schema })` would validate
 *   nothing and let every request through unvalidated — the worst possible
 *   failure mode for a validation middleware, because it looks like it works.
 * - **A schema placed under a non-target key.** `validate({ user: UserSchema })`
 *   reads as "validate the user" but silently does nothing.
 *
 * An empty map stays a pass-through: that is a documented, tested contract, not
 * a typo.
 */
function normalizeSchemas(arg: StandardSchemaV1 | RequestSchemas): RequestSchemas {
  // A JS caller can pass anything; the declared type is not a runtime guarantee.
  const candidate: unknown = arg;
  if (candidate === null || typeof candidate !== 'object') {
    throw new TypeError(
      'validate(): expected a Standard Schema or a { body, query, params } schema map. ' +
        `Received: ${describe(candidate)}.`
    );
  }

  const record = candidate as Record<string, unknown>;
  if ('~standard' in record) return { body: candidate as StandardSchemaV1 };

  const keys = Object.keys(record);
  const unknown = keys.filter((key) => !VALID_TARGETS.includes(key));
  if (unknown.length > 0) {
    throw new TypeError(
      `validate(): unknown schema target${unknown.length > 1 ? 's' : ''} ` +
        `${unknown.map((k) => `"${k}"`).join(', ')}. ` +
        `Valid targets are: body, query, params. ` +
        `(A misspelled target would validate nothing and silently pass every request.)`
    );
  }

  for (const key of keys) {
    const schema = record[key];
    if (schema === undefined) continue;
    if (schema === null || typeof schema !== 'object' || !('~standard' in schema)) {
      throw new TypeError(
        `validate(): the "${key}" target is not a Standard Schema ` +
          `(it must have a "~standard" property). Received: ${describe(schema)}.`
      );
    }
  }

  return record;
}

/**
 * Render a rejected value for an error message without risking a throw or a
 * useless `[object Object]`.
 */
function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null || typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `an array of length ${String(value.length)}`;
  const keys = Object.keys(value).join(', ');
  return `an object with keys [${keys}]`;
}
