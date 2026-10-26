# Tasks

## 1. RFC gate (before any code)

- [ ] 1.1 Write `docs/RFC/request-data/048-response-helper-status-argument.md` from `docs/RFC/TEMPLATE.md`, recording the precedence rule, the persistence-into-`ctx.status` decision, the 200-599 validation range, and the rejected alternatives from `design.md` (D1-D4). Verify the RFC exists, follows the template's sections, and `grep -ril "status argument" docs/RFC/` returns no pre-existing RFC already governing this decision.
- [ ] 1.2 Set the RFC's status to Approved and link it from `proposal.md`'s Impact section. Verify the link resolves and the RFC states it gates this change.

## 2. Contract and unit tests first (RED)

- [ ] 2.1 In `packages/adapters/conformance/src/suite.ts` (`defineResponseConformance`), add scenarios: `ctx.json(data, 201)`, `ctx.html(content, 202)`, `ctx.send('body', 203)` each return the requested status and the unchanged media type. Verify `pnpm --filter @nextrush/adapter-conformance test` fails with the new scenarios before implementation.
- [ ] 2.2 Add precedence and default scenarios: explicit argument beats a prior `ctx.status` assignment; omitted argument keeps the carried status; nothing set yields 200. Verify all three fail for the right reason.
- [ ] 2.3 Add the persistence scenario: a middleware reading `ctx.status` after `await next()` observes the status the handler passed to the helper. Verify it fails.
- [ ] 2.4 Add rejection scenarios: `99`, `600`, and `201.5` each throw a `RangeError` naming `200` and `599`, write no header or body byte, and leave the error handler able to answer a completed 500. Verify the scenarios fail.
- [ ] 2.5 Add body-suppression and commit-guard scenarios: `ctx.json(data, 204)`, `ctx.json(data, 304)`, HEAD with `ctx.json(data, 201)`, and a post-commit `ctx.json(data, 500)` that changes neither the response nor `ctx.status`. Verify they fail.
- [ ] 2.6 Add a Node-specific test in `packages/adapters/node/src/__tests__` proving `ctx.send({ a: 1 }, 201)` reaches the JSON path with status 201, plus a `ctx.send(stream, 204)` case asserting the body is suppressed and the stream is not left dangling. Verify both fail.
- [ ] 2.7 Add unit tests for a shared status validator in `packages/runtime/src/__tests__` covering 199, 200, 599, 600, `201.5`, `NaN`, and `'201'` as a runtime value. Verify they fail.

## 3. Shared validator (GREEN for 2.7)

- [ ] 3.1 Add `packages/runtime/src/response-status.ts` exporting `assertResponseStatus(status: number, helper: string): void` that throws `RangeError` outside integers 200-599 and export it from `packages/runtime/src/index.ts`. Verify `pnpm --filter @nextrush/runtime test` passes and the file stays under 100 lines.
- [ ] 3.2 Update `packages/runtime/src/__tests__/public-surface.test.ts` (or the package's surface-lock test) for the new export. Verify the runtime surface test passes.

## 4. Web adapters (Bun, Deno, Edge, serverless)

- [ ] 4.1 Add the optional status argument to `json`, `send` and `html` in `packages/runtime/src/web-context-base.ts`: return early on `responded`, then `assertResponseStatus`, then assign `this.status`, then delegate to the builder with the resolved status. Verify the new conformance scenarios pass under the Bun driver (`pnpm --filter @nextrush/adapter-bun test`) and the Deno driver where the runtime is available.
- [ ] 4.2 Confirm `WebResponseBuilder` needs no signature change by running its existing unit tests unchanged; if a change proves necessary, record why in a comment on this task's commit. Verify `pnpm --filter @nextrush/runtime test` passes.
- [ ] 4.3 Update `packages/runtime` unit tests for the context methods (precedence, persistence, post-commit no-op) where they are cheaper than the conformance round trip. Verify `pnpm --filter @nextrush/runtime test` passes with coverage of the new branches.

## 5. Node adapter

- [ ] 5.1 Add the optional status argument to `json`, `send`, and `html` in `packages/adapters/node/src/context.ts`, ordering the commit check before the assignment and assigning before `send()`'s object delegation to `json()`. Verify `pnpm --filter @nextrush/adapter-node test` passes, including 2.6's cases.
- [ ] 5.2 Verify Node parity for the shared rejection and suppression scenarios by running the conformance suite against the Node driver: `pnpm --filter @nextrush/adapter-node test`. Confirm identical status, headers and body bytes to the Bun driver.

## 6. Public types and documentation

- [ ] 6.1 Update the `Context` interface in `packages/types/src/context.ts`: optional status parameters on `json`, `send` and `html`, with TSDoc stating precedence ("argument, then `ctx.status`") and that the argument persists into `ctx.status`. Verify `pnpm --filter @nextrush/types typecheck` passes and an existing single-argument call site still compiles.
- [ ] 6.2 Update `apps/website/content/docs/concepts/(core-framework)/context.mdx`, `guides/api-development/error-handling.mdx`, and the `res.status(code)` rows in `migrate/from-express.mdx` and `migrate/from-fastify.mdx` to show both forms and the precedence rule. Verify `pnpm docs:validate` passes and every code sample matches the new signatures.
- [ ] 6.3 Add the changeset for a minor release of `@nextrush/types`, `@nextrush/runtime`, and `@nextrush/adapter-node`. Verify `pnpm validate:changeset-baselines` passes.

## 7. Integration gates

- [ ] 7.1 Run `pnpm typecheck` and `pnpm lint` across the workspace; both clean with no new warnings.
- [ ] 7.2 Run the conformance suite on every shipped adapter driver (Node, Bun, Deno, Edge, serverless) and confirm the explicit-status scenarios pass byte-identically on all of them.
- [ ] 7.3 Run `pnpm check:coverage` and confirm every touched package stays at or above the project's 90% line-coverage threshold.
- [ ] 7.4 Run the full test suite for the touched packages (`pnpm --filter @nextrush/runtime test`, `--filter @nextrush/adapter-node`, `--filter @nextrush/adapter-bun`, `--filter @nextrush/adapter-conformance`).
- [ ] 7.5 Confirm no performance claim was introduced: `rg -n "zero[- ]cost|no overhead|faster" openspec/changes/context-response-status-args docs packages --glob '!**/dist/**'` shows no new assertion attributable to this change.

## Workflow follow-up

- Archive the change after review, per `openspec/README.md`.
- Capture the durable decision as an ADR in `docs/adr/` if the project requires one before archive.
