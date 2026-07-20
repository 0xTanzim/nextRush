# docs

This is a Next.js application generated with
[Create Fumadocs](https://github.com/fuma-nama/fumadocs).

It is a Next.js app with [Static Export](https://nextjs.org/docs/app/guides/static-exports) configured.

Run development server:

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

Open http://localhost:8080 with your browser to see the result.

## End-to-end checks (Playwright)

Smoke tests for key docs pages (getting started, framework overview):

```bash
pnpm exec playwright install chromium   # once per machine
pnpm test:e2e                           # starts dev server if needed
pnpm test:e2e:ui                        # interactive UI mode
```

## Verification harness (`pnpm docs:verify`)

Documentation verification (`pnpm docs:verify`, introduced in the v3 rebuild) treats
verification as the "test layer" for docs content — a green run is a precondition
for merging any content change, the same way a green test suite gates code.

```bash
pnpm docs:verify
```

Runs 4 independent checks against `content/docs/**/*.mdx` and exits non-zero if
any check has findings. Source: `scripts/verify/`.

1. **Internal link check** (`link-check.ts`) — every `[text](/docs/...)` link is
   resolved against the real file tree + directory index pages. Anchors
   (`#section`) are stripped before resolution — this verifies the PAGE exists,
   not that the heading exists on it (would require rendering the MDX).

2. **Code-example compile check** (`compile-check.ts`) — every fenced ` ```ts `/
   ` ```typescript ` block in a deterministic sample of files (default 15,
   sorted by path) is typechecked for real via the TypeScript Language Service
   API, path-mapped so every NextRush workspace package resolves to its
   `src/index.ts` (source, not `dist` — packages don't need to be built).
   Each snippet is checked as an **isolated** root file sharing one
   `DocumentRegistry` (fast: shared dependency parsing) — isolation matters
   because an earlier prototype that put every snippet into one shared `tsc`
   project had a proven bug: syntactically-broken fragment fastest (a common,
   legitimate doc pattern — e.g. a single `@Body(...)` decorator shown outside
   a class body) could silently suppress a real semantic error in an unrelated
   snippet. See the doc comment at the top of `compile-check.ts` for the full
   trace. **Limitation:** snippets that continue a preceding snippet in the
   same page (a variable declared two code blocks earlier) will report
   `Cannot find name` — expected noise for illustrative fragments, not
   necessarily an authoring bug. A future iteration could special-case
   "signature-only" blocks (bare `function name(...): T;` declarations) to
   skip semantic checking entirely, since those are reference material, not
   runnable examples.

3. **Lint check** (`lint-check.ts`) — three independent rules from
   `docs-standards.instructions.md`: forbidden marketing/hedge words (prose
   only, code blocks excluded), generic ("Overview", "Details") H2/H3 heading
   intent, and import-style (flags `@nextrush/decorators` / `@nextrush/controllers`
   imports in code blocks — the deprecated pre-consolidation packages — instead
   of `nextrush/class`). **Limitation:** import-style only flags import
   *statements* inside fenced code, not prose mentions — a migration page
   showing a deprecated import as the "before" side of a comparison will
   correctly trigger this and needs human judgment, not an exemption list.

4. **Reference-match check** (`reference-match.ts`) — best-effort **stub** for
   the full generated-reference tooling (T4/T12): every hand-written bare
   signature (`function name(...): T;`) in `api-reference/**/*.mdx` is checked
   against the real exports of the package the page documents (inferred from
   the file path, e.g. `api-reference/middleware/cors.mdx` → `@nextrush/cors`).
   **Limitation:** this is name-existence checking only, not type equality — it
   catches a renamed/removed/misspelled export, not a signature whose
   parameters or return type have drifted. `fumadocs-typescript` (T4) replaces
   this with generated tables that can't drift by construction.

## Explore

In the project, you can see:

- `lib/source.ts`: Code for content source adapter, [`loader()`](https://fumadocs.dev/docs/headless/source-api) provides the interface to access your content.
- `lib/layout.shared.tsx`: Shared options for layouts, optional but preferred to keep.

| Route                     | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `app/(home)`              | The route group for your landing page and other pages. |
| `app/docs`                | The documentation layout and pages.                    |
| `app/api/search/route.ts` | The Route Handler for search.                          |

### Fumadocs MDX

A `source.config.ts` config file has been included, you can customise different options like frontmatter schema.

Read the [Introduction](https://fumadocs.dev/docs/mdx) for further details.

## Learn More

To learn more about Next.js and Fumadocs, take a look at the following
resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js
  features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Fumadocs](https://fumadocs.dev) - learn about Fumadocs
