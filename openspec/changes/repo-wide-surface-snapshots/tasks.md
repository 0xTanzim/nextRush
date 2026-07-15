## 1. Foundation layer (types, errors already/next)

- [ ] 1.1 `@nextrush/errors` — read `src/index.ts`, write `public-surface.test.ts` locking its runtime export list

## 2. Core / router / runtime / di

- [ ] 2.1 `@nextrush/core` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 2.2 `@nextrush/router` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 2.3 `@nextrush/runtime` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 2.4 `@nextrush/di` — read `src/index.ts`, write `public-surface.test.ts`

## 3. Adapters

- [ ] 3.1 `@nextrush/adapter-node` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 3.2 `@nextrush/adapter-bun` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 3.3 `@nextrush/adapter-deno` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 3.4 `@nextrush/adapter-edge` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 3.5 `@nextrush/adapter-serverless` — read `src/index.ts`, write `public-surface.test.ts`

## 4. Middleware

- [ ] 4.1 `@nextrush/cors` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.2 `@nextrush/helmet` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.3 `@nextrush/csrf` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.4 `@nextrush/body-parser` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.5 `@nextrush/multipart` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.6 `@nextrush/rate-limit` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.7 `@nextrush/compression` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.8 `@nextrush/cookies` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.9 `@nextrush/validation` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.10 `@nextrush/request-id` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.11 `@nextrush/timer` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.12 `@nextrush/static` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.13 `@nextrush/template` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.14 `@nextrush/logger` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 4.15 `@nextrush/openapi` — read `src/index.ts`, write `public-surface.test.ts`

## 5. Extensions / streaming

- [ ] 5.1 `@nextrush/events` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 5.2 `@nextrush/websocket` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 5.3 `@nextrush/stream` — read `src/index.ts`, write `public-surface.test.ts`

## 6. Deprecated shims (still published — surface must be locked before T053 can remove them safely)

- [ ] 6.1 `@nextrush/controllers` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 6.2 `@nextrush/decorators` — read `src/index.ts`, write `public-surface.test.ts`

## 7. Tooling / meta

- [ ] 7.1 `@nextrush/dev` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 7.2 `@nextrush/testing` — read `src/index.ts`, write `public-surface.test.ts`
- [ ] 7.3 `create-nextrush` — read `src/index.ts` (or its actual entry point — this package may not follow the barrel convention; confirm), write `public-surface.test.ts`
- [ ] 7.4 `nextrush` (meta package) — read `src/index.ts`, write `public-surface.test.ts`

## 8. Verify and close out

- [ ] 8.1 VERIFY: `pnpm test` green across all 33 newly-tested packages
- [ ] 8.2 VERIFY: for a sample of 3 packages spanning different export shapes (runtime-heavy, type-heavy, hybrid), confirm the test actually fails when a throwaway export is added, then remove the throwaway — proving the lock is real, not a vacuous pass
- [ ] 8.3 VERIFY: `pnpm typecheck` and `pnpm lint` clean on every new test file
- [ ] 8.4 Log any discovered "surface smell" (an export that looks like a leaked internal) as a Finding in this section — package name + export name — without modifying the export itself
- [ ] 8.5 Update `docs/audits/03-gap-checklist.md`'s T005 entry: ◐ → ☑, with a "Verified:" note citing all 35 packages now covered (2 pre-existing + 33 from this change), and update the Progress Dashboard/Dependency Graph accordingly (T005 → T053 leg now clear)
- [ ] 8.6 Add a changeset if any package's `package.json`/build config needed a `vitest`/`expectTypeOf` devDependency addition (expected to be none, per the design's assumption that vitest is already present everywhere `pnpm test` runs — confirm, don't assume)
