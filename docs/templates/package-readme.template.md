<!-- TEMPLATE — copy to packages/<path>/README.md, replace every <PLACEHOLDER>, delete these HTML comments.
     Authoring rules, tier depth, callout types, and the "what renders where" table live in
     ./package-readme-authoring-guide.md — READ IT ONCE before writing. This template is the clean
     skeleton only. Section order is frozen; keep it. Depth follows package tier (guide §tiers). -->

# @nextrush/NAME

> <PLACEHOLDER: one concrete sentence — what this does and who it's for.>

[![npm version](https://img.shields.io/npm/v/@nextrush/NAME.svg)](https://www.npmjs.com/package/@nextrush/NAME)
[![downloads](https://img.shields.io/npm/dm/@nextrush/NAME.svg)](https://www.npmjs.com/package/@nextrush/NAME)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/NAME.svg)](https://bundlephobia.com/package/@nextrush/NAME)
[![types](https://img.shields.io/npm/types/@nextrush/NAME.svg)](https://www.npmjs.com/package/@nextrush/NAME)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/NAME.svg)](../../LICENSE)

<!-- Package identity — the meta facts in one scannable block. Delete any row that doesn't apply. -->

|  |  |
| --- | --- |
| **Package type** | `<Core · Middleware · Registrar · Extension · Adapter · Tooling>` |
| **Status** | `<Stable · Beta · Experimental>` |
| **Support tier** | `<Public — stable>` (sealed public API) — see [ADR-0005](../../docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Runtime** | Universal — Node · Bun · Deno · Edge |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v<x.y.z>` |
| **Maintained** | ✅ Yes |

## At a glance

<!-- Capabilities / selling points — the identity block above already states type/status/runtime. -->

- ✅ **Zero runtime dependencies** <!-- or: peer-depends on X — be honest -->
- ✅ **ESM-only**, tree-shakable
- ✅ **Fully typed** — strict TypeScript, zero `any`
- 📦 **Bundle:** ~`<X>` KB min+gzip

<details>
<summary><strong>Table of contents</strong></summary>

<!-- (Tier 1 only) anchors = heading lowercased, spaces → hyphens -->
[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Features](#features) · [Mental model](#mental-model) · [Usage](#usage) · [API reference](#api-reference) · [Options](#options) · [Performance](#performance) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Ecosystem](#ecosystem) · [Architecture](#architecture)

</details>

---

## The problem

<!-- (Tier 1–2) Open with the reader's pain, concretely — the thing they get wrong by hand today. -->

<PLACEHOLDER: the concrete problem.>

```ts
// TODAY, without this package — the thing that's easy to get wrong:
```

## When to use

<!-- (Tier 1–2) Kills confusion (e.g. @nextrush/core vs nextrush). Point elsewhere when it's the wrong fit. -->

**Use `@nextrush/NAME` if:**

- ✓ <PLACEHOLDER>
- ✓ <PLACEHOLDER>

**Reach for something else if:**

- ✗ <PLACEHOLDER> → use [`@nextrush/<other>`](../<path>)

---

## Installation

```bash
pnpm add @nextrush/NAME
# npm i @nextrush/NAME · yarn add @nextrush/NAME · bun add @nextrush/NAME
```

> [!NOTE]
> Already using `nextrush`? <PLACEHOLDER: state whether this ships with the meta package. e.g.
> "This is included — install separately only to import `<X>` directly." Delete if standalone.>

## Quick start

<!-- The ONE golden-path example. 100% runnable — real imports, no "...". This is what people scroll for. -->

```ts
import { createApp, listen } from 'nextrush';
// import { <export> } from '@nextrush/NAME';

const app = createApp();

// <PLACEHOLDER: smallest meaningful working example>

listen(app, 8080);
```

<PLACEHOLDER: one sentence — what just happened, and why it's this simple.>

## Features

<!-- (Tier 1–2) Bullets sell the package. Bold the capability, one line each. -->

- **<Capability>** — <one line>
- **<Capability>** — <one line>
- **<Capability>** — <one line>

## Mental model

<!-- (Tier 1–2) The one idea that makes the API click. ASCII only — Mermaid does NOT render on npm. -->

<PLACEHOLDER: the core idea in plain language.>

```text
request ──▶ <this package> ──▶ ctx.<result>
                │
                └─ <the key internal step>
```

> [!TIP]
> The full request lifecycle (Mermaid) is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Usage

<!-- (Tier 1–2) One subsection per real task, common → advanced. Developers search by task, not API name. -->

### <PLACEHOLDER: task 1>

```ts
```

### <PLACEHOLDER: task 2>

```ts
```

## API reference

<!-- The sealed public surface only (ADR-0005). "Since" helps consumers track when an export landed. -->

| Export | Signature | Since | Description |
| ------ | --------- | ----- | ----------- |
| `<name>` | `(<args>) => <ret>` | `<x.y.z>` | <what it does> |
| `type <Name>` | — | `<x.y.z>` | <what it types> |

## Options

<!-- (Tier 1–2) Mark security-relevant defaults. Zero-config? Replace the table with "No configuration — <why>". -->

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `<opt>` | `<type>` | `<default>` | <effect; flag if security-relevant> |

## Performance

<!-- CONDITIONAL — include ONLY for perf-relevant packages: router · core · body-parser · serializer ·
     static · adapters · compression · stream. Nobody asks "how fast are cookies?" — for everything
     else, DELETE this whole section (heading included). Claims must be backed by apps/benchmark. -->

<PLACEHOLDER: measured characteristics from apps/benchmark (baseline vs result, hardware noted).>

## Compatibility

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | ESM-only |
| Bun / Deno / Edge | ✅ / ✅ / ✅ | via `@nextrush/adapter-*`, pinned by conformance |

<!-- (Middleware especially) State ordering/companion expectations. Delete lines that are "none". -->
- **Peer dependencies:** `<none | @nextrush/<x>>`
- **Works with:** `<e.g. runs after @nextrush/body-parser>`
- **Incompatible with:** `<none | @nextrush/<y> (both set the same header)>`

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CJS consumers can
> `require()` this ESM package natively. See the [Module Format Policy](../../README.md#module-format-policy).

---

## Troubleshooting

<!-- (Tier 1–2) The 2–4 errors real users hit → the fix. Collapsible so the happy path isn't cluttered. -->

<details>
<summary><strong><PLACEHOLDER: symptom / error message></strong></summary>

**Cause:** <why> · **Fix:** <the concrete change>

```ts
```

</details>

## FAQ

<!-- (Tier 1–2) 3–5 real questions. Prevents repeat GitHub issues. -->

**<PLACEHOLDER: e.g. Can I use this without `nextrush`?>**
<answer>

**Why ESM-only?**
See the [Module Format Policy](../../README.md#module-format-policy).

**Does it work on Bun / Deno / Edge?**
<answer>

---

## Ecosystem

You are here:

```text
nextrush
├── @nextrush/core
├── @nextrush/router
├── @nextrush/NAME        ← you are here
└── @nextrush/<others>
```

**Works well with:**

- [`@nextrush/<x>`](../<path>) — <one line>
- [`@nextrush/<y>`](../<path>) — <one line>

**See also** — common next steps (not dependencies):

- [`@nextrush/router`](../router) · [`@nextrush/body-parser`](../middleware/body-parser) · [`@nextrush/openapi`](../middleware/openapi) <!-- pick the packages a reader of THIS one typically reaches for next -->

## Architecture

How it works internally — module layout, request lifecycle, key decisions and trade-offs (with
diagrams) — is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
<PLACEHOLDER: link `docs/RFC/...` / `docs/adr/...`>.

## Need help?

<!-- Verified links only. As of now the repo has NO Discord and GitHub Discussions is disabled
     (→ 404) — add a row here only if/when they are enabled; never link a dead channel. -->

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Wiki](https://github.com/0xTanzim/nextRush/wiki) · [Architecture](./ARCHITECTURE.md) · [RFCs](../../docs/RFC) · [Benchmarks](../../apps/benchmark)
- 🐛 **Ask or report** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](../../CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

<!-- ✅ Before publishing: run the done-checklist in ./package-readme-authoring-guide.md.
     Key npm traps: no Mermaid, no relative images, absolute badge URLs, Quick start fully runnable. -->
