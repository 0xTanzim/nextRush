---
"@nextrush/router": patch
"@nextrush/types": patch
---

Router documentation accuracy, an internal `router.ts` split, and audit-flagged deduplication —
all non-breaking (public-surface snapshot byte-identical; 212/212 behavioral tests green).

- **`@nextrush/router`**: finished splitting `router.ts` so every shipping source file is now
  under the 300-line ceiling (`router.ts` is 298 lines; the remaining logic moved into focused
  internal modules `dispatch.ts`, `state.ts`, and `constants.ts` plus existing siblings, along the
  same seams the earlier modularity split used — no new structural pattern). Resolved the router
  audit's flagged duplications: `EMPTY_PARAMS` now has a single definition in a leaf `constants.ts`
  module, and the route-matching / allowed-methods path-normalization logic is consolidated into
  one shared `normalizePathForMatch` helper. Corrected the residual "radix tree" wording to
  "segment trie" across the README and the `TrieNode.children` JSDoc (which now accurately states
  children are keyed by whole path segment, not by first character). No exported symbol, signature,
  or runtime behavior changed — confirmed by the package's public-surface snapshot test and full
  suite.

- **`@nextrush/types`**: documentation-comment-only correction. The `router.ts` type header no
  longer claims the router "uses a radix tree for efficient route matching"; it now accurately
  describes the segment trie keyed by whole path segments (O(k) lookups). No type, signature, or
  export change.
