/**
 * Resolution guard for the `nextrush/class` subpath's optional peer dependencies.
 *
 * `@nextrush/class`, `@nextrush/di`, and `reflect-metadata` are OPTIONAL peer dependencies of
 * `nextrush` (see docs/RFC/framework-composition/020-framework-composition-integrity.md) — a
 * functional-only install never resolves them. When a consumer imports `nextrush/class`
 * without having installed the peer, the resulting module-not-found error is opaque. This
 * module recognizes that specific failure and rewrites it into an actionable message naming
 * the missing package and the exact install command, without swallowing unrelated errors.
 */

const MISSING_MODULE_PATTERN = /Cannot find (?:module|package) '(@nextrush\/class|@nextrush\/di|reflect-metadata)'/;

/**
 * Given an error thrown while loading `nextrush/class`, return an actionable message if it is
 * the specific "the optional class/DI peer is not installed" case, or `null` if the error is
 * unrelated (in which case the caller should re-throw the original error unchanged).
 */
export function describeMissingClassPeerError(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  if (!MISSING_MODULE_PATTERN.test(message)) {
    return null;
  }

  return (
    'nextrush/class requires @nextrush/class and reflect-metadata as optional peer ' +
    'dependencies, which are not installed in this project. Install them:\n' +
    '  pnpm add @nextrush/class reflect-metadata'
  );
}
