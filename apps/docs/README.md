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

## Docs tooling foundation (llms.txt · AutoTypeTable · OpenAPI)

The v4 docs site standardizes on three tooling capabilities (OpenSpec change
`docs-v4-rebuild` §2). Two are live; the third is pending a decision.

### `llms.txt` / `llms-full.txt` — first-class, static (2.1 ✅)

AI/agent-readable docs are a **first-class, statically-generated** output, not an
incidental build artifact:

- `src/app/llms.txt/route.ts` — a structured index: every page grouped by section
  (titles/order from `appConfig.llms.sectionTitles`), each linked to its `.md`
  source and canonical URL, plus the skills catalog. `force-static`.
- `src/app/llms-full.txt/route.ts` — the full corpus: every page's Markdown
  concatenated via `getLLMText()`, which uses Fumadocs' native
  `page.data.getText('processed')` and strips MDX components/imports
  (`sanitizeLLMMarkdown` in `lib/source.ts`) so the output is clean prose. `force-static`.
- `src/app/llm.txt/` and `ask-ai-index.json` round out the agent surface.

> **v4-IA coupling:** `appConfig.llms.sectionTitles` still lists the v3 section
> keys (`getting-started`, `api-reference`, …). Unknown sections are handled
> gracefully (title-cased, appended), so nothing breaks — but when **Wave B0**
> finalizes the v4 IA (`start`/`concepts`/`guides`/`recipes`/`production`/
> `reference`/`internals`/`migrate`/`resources`), update `sectionTitles` to match.

### `AutoTypeTable` — reference tables from live TS source (2.3 ✅)

Reference type/option tables generate from the actual TypeScript source, so they
cannot drift from the code. Prefer `AutoTypeTable` over the hand-authored
`TypeTable` for reference pages (per `documentation.instructions.md`).

- Wired in `source.config.ts` (the `remarkAutoTypeTable` plugin, output name
  `AutoTypeTable`) **and** registered in `src/mdx-components.tsx` (the JSX form,
  with a `path` resolved to the monorepo root). Shared generator + on-disk cache:
  `src/lib/type-table-generator.ts`.
- Usage: `<AutoTypeTable path="packages/types/src/context.ts" name="Context" />`.
- Live sample: `content/docs/reference/core/types.mdx`.

### OpenAPI reference via Scalar (2.2 ✅ — read-only, static)

Interactive API reference, generated at build time and rendered client-side:

- **Spec (build time):** `scripts/generate-openapi.ts` describes a representative
  API as the framework's own `RouteDefinition[]` (with `endpoint()` docs + zod
  request/response schemas) and runs the real `@nextrush/openapi`
  `generateDocument()` — the same transform any NextRush app uses — writing
  `public/openapi.json` (OpenAPI 3.1). Wired into `prebuild`, so it stays in sync
  with the generator. Run it directly with `npx tsx scripts/generate-openapi.ts`.
- **Renderer:** the `ScalarApiReference` MDX component
  (`src/components/mdx/scalar-api-reference.tsx`, registered in `mdx-components.tsx`)
  renders that spec via `@scalar/api-reference-react`. It's loaded with
  `next/dynamic` + `ssr: false` because the site is a **static export** — Scalar is
  a browser widget and must not run during prerender. Drop it into any reference
  page: `<ScalarApiReference url="/openapi.json" />` (the reference page itself is
  authored in Track B Wave B3).

> **Static-export caveat:** the reference renders read-only. Scalar "try it out"
> fires real requests and has **no live target** in a static deploy — the spec
> carries no `servers` URL. Point `servers` at a separately-deployed demo API only
> if live try-it-out is ever wanted; it does not affect the docs build.



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
