# Engineering Reports

Formal architecture/performance/security reviews and audits live here, **grouped by domain** so
the directory stays navigable as more reports land. These files are tracked in git (they are part
of the project's history — not gitignored).

**Writing a new report?** Copy [`TEMPLATE.md`](TEMPLATE.md) — the standard audit/review format
(Executive Summary → System Understanding → Architecture → Data Flow → per-area findings →
prioritised recommendations → migration → conclusion, with a nine-field finding block and a
done-checklist). It follows the `architecture-review.md` steering: understand before judging,
evidence-cited findings, no generic filenames.

## Layout

Group by the package/domain the report is about, mirroring the capability/package structure:

```
report/
├── architecture/   # whole-system / cross-cutting architecture reviews
├── core/           # @nextrush/core, context, request pipeline, general perf reviews
├── router/         # @nextrush/router reviews and route-matching profiles
├── adapters/       # @nextrush/adapter-* (node/bun/deno/edge/serverless) reviews
├── middleware/     # @nextrush/<middleware> reviews (body-parser, cors, compression, …)
├── di/             # @nextrush/di / @nextrush/class (add when the first lands)
└── extensions/     # events / websocket / stream (add when the first lands)
```

Create a new group folder only when the first report for that domain arrives — don't pre-create
empty folders.

## Naming

- Descriptive, scope-first filenames the reader understands without opening:
  `<domain>-<subject>-review.md`, `<subject>-profile.md`, `<subject>-followup.md`.
  Examples: `middleware/middleware-body-parser-review.md`, `router/route-params-profile.md`.
- **Never** generic names (`report.md`, `analysis.md`, `review.md`).
- One report per scope. A follow-up to an existing review is `<subject>-followup.md` in the same
  folder, not a rewrite of the original.

## What belongs here vs. elsewhere

- **Here:** point-in-time reviews, audits, and profiles — the *findings* and analysis.
- **`docs/RFC/`:** durable architectural *decisions* that come out of a review (an audit may
  recommend a change; the ratified decision is an RFC).
- **`openspec/`:** the *requirements* a change implements (delta specs → living capability specs).
- **`apps/docs/`:** user-facing documentation and blog posts.

A review here often spawns an RFC and an OpenSpec change; cross-link between them rather than
duplicating content.
