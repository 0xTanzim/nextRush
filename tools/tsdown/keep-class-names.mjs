/**
 * rolldown plugin: guarantee that class names survive downstream transforms.
 *
 * ## Why this exists
 *
 * Class names are **public API**, not an implementation detail. `@nextrush/errors`
 * derives an error's identity from `this.constructor.name` (`NextRushError` sets
 * `this.name`, and `toJSON()` exposes it as `error`), so `err.name` is part of the
 * framework's contract — application code branches on it, and so do our tests.
 *
 * ## The failure this prevents
 *
 * For any class whose body references itself (e.g. `ValidationError`'s static
 * `fromField` → `new ValidationError(...)`), rolldown emits the class as a **named
 * class expression assigned to a same-named `var`**:
 *
 * ```js
 * var ValidationError = class ValidationError extends NextRushError { … };
 * ```
 *
 * esbuild — Vitest's transform, and Vite's dependency optimizer, both of which
 * hardcode `keepNames: false` — deconflicts that outer/inner name collision by
 * renaming the **inner** binding:
 *
 * ```js
 * var ValidationError = class ValidationError2 extends NextRushError { … };
 * ```
 *
 * An explicit class-expression name wins over the inferred one, so `X.name` silently
 * becomes `'X2'` and `err.toJSON().error` becomes `'ValidationError2'`. Native loaders
 * (Node, Bun, Deno) never rename, and a `keepNames`-aware bundler restores the name —
 * so the corruption only shows up for consumers whose tooling renames, which is
 * invisible until it breaks their error handling.
 *
 * ## The fix
 *
 * Append an explicit name definition for every self-named class in the emitted chunk.
 * The definition travels with the code, so the name is correct no matter how many
 * transforms the file passes through afterwards. Appending at the end of the chunk is
 * safe: a chunk's classes are only reachable by a consumer after the chunk has finished
 * evaluating, and the appended lines carry no source mapping of their own.
 *
 * Classes emitted as **anonymous** class expressions (`var Sub = class extends Base {}`)
 * need no help — JavaScript's NamedEvaluation gives them their binding name (verified on
 * Node/esbuild), and esbuild does not rename them.
 */

/** Matches rolldown's self-named class-expression output: `var X = class X …`. */
const SELF_NAMED_CLASS = /^var (\w+) = class \1\b/gm;

/**
 * Create the plugin.
 *
 * @returns {import('rolldown').Plugin} A rolldown plugin that restores class names.
 */
export function keepClassNames() {
  return {
    name: 'nextrush:keep-class-names',
    renderChunk(code) {
      const names = [...code.matchAll(SELF_NAMED_CLASS)].map((match) => match[1]);
      if (names.length === 0) return null;

      const footer = names
        .map(
          (name) =>
            `Object.defineProperty(${name}, "name", { value: ${JSON.stringify(name)}, configurable: true });`
        )
        .join('\n');

      // `map: null` keeps the incoming sourcemap valid; the appended lines are simply
      // unmapped, which is what a banner/footer-style edit is expected to do.
      return { code: `${code}\n${footer}\n`, map: null };
    },
  };
}
