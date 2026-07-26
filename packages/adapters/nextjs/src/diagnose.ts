/**
 * @nextrush/adapter-nextjs - Mount-mismatch diagnostic
 *
 * See RFC-024 §8.4/§8.7. Pure and Web-standard: no `Request`, no I/O, no
 * runtime-specific API. Diagnoses, never rescues — the caller decides whether
 * and when to log this; the function never serves an alternate response.
 *
 * @packageDocumentation
 */

/** The shape `explainMountMismatch` needs from Next's route params. */
export type MountParams = Record<string, string | string[] | undefined>;

export interface MountMismatchInput {
  /** The raw request pathname (still percent-encoded), e.g. `/api/hello%20world`. */
  pathname: string;
  /** Next's resolved catch-all params for this route file. */
  params: MountParams;
  /** Given a candidate app-relative path, does the application have a route for it? */
  routeExists: (path: string) => boolean;
}

/** The single catch-all array value in `params`, or `undefined` if none exists. */
function findCatchAll(params: MountParams): string[] | undefined {
  for (const value of Object.values(params)) {
    if (Array.isArray(value)) return value;
  }
  return undefined;
}

export interface MountSplit {
  /** The mounted prefix, e.g. `/api`. */
  prefix: string;
  /** The pathname with the prefix removed, e.g. `/hello`. */
  stripped: string;
}

/**
 * Split a pathname into its inferred mount prefix and the remainder, by
 * counting segments against the catch-all `params` Next resolved for this
 * route file — never by string matching (Next percent-decodes `params` while
 * `request.url` stays encoded, so a `.replace()` would miss an encoded
 * segment).
 *
 * @returns `undefined` when there is nothing to infer: no catch-all key in
 * `params` at all (a static route file or a single dynamic `[id]` segment,
 * which is string- not array-valued), or an unreachable negative drop count.
 */
export function resolveMountSplit(pathname: string, params: MountParams): MountSplit | undefined {
  const catchAll = findCatchAll(params);
  if (catchAll === undefined) return undefined;

  const rawSegments = pathname.split('/').filter((s) => s.length > 0);
  const drop = rawSegments.length - catchAll.length;
  if (drop < 0) return undefined;

  return {
    prefix: '/' + rawSegments.slice(0, drop).join('/'),
    stripped: '/' + rawSegments.slice(drop).join('/'),
  };
}

/**
 * Explain a mount-prefix mismatch, or return `undefined` when there is nothing
 * to explain — either the app genuinely has no such route, or the route file
 * has no catch-all segment to infer a prefix from (a static file or a
 * single dynamic segment).
 */
export function explainMountMismatch(input: MountMismatchInput): string | undefined {
  const split = resolveMountSplit(input.pathname, input.params);
  if (split === undefined) return undefined;

  const { prefix, stripped } = split;
  if (!input.routeExists(stripped)) return undefined;

  return (
    `[nextrush/nextjs] 404 for ${input.pathname}\n\n` +
    `  This route file is mounted at ${prefix}, but your app has no route for ` +
    `${input.pathname} — it does have ${stripped}.\n\n` +
    `  Mount your router with the prefix:\n` +
    `      app.route('${prefix}', router)\n\n` +
    `  (This message appears in development only.)`
  );
}
