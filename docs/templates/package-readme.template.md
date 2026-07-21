<!-- TEMPLATE — copy to packages/<path>/README.md, replace every <PLACEHOLDER>, delete these HTML comments.
     Authoring rules, tier depth, callout types, and the "what renders where" table live in
     ./package-readme-authoring-guide.md — READ IT ONCE before writing. Section order is FROZEN.
     The README is the package's PRODUCT PAGE (npm). Within the first screen it must answer three
     questions: (1) what is this? (2) do I install it, or is it already in `nextrush`? (3) where
     does it fit in the ecosystem? Depth follows package tier (guide §tiers). -->

# @nextrush/NAME

> <PLACEHOLDER: one concrete sentence — what this does and who it's for.>

[![npm version](https://img.shields.io/npm/v/@nextrush/NAME.svg)](https://www.npmjs.com/package/@nextrush/NAME)
[![downloads](https://img.shields.io/npm/dm/@nextrush/NAME.svg)](https://www.npmjs.com/package/@nextrush/NAME)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/NAME.svg)](https://bundlephobia.com/package/@nextrush/NAME)
[![types](https://img.shields.io/npm/types/@nextrush/NAME.svg)](https://www.npmjs.com/package/@nextrush/NAME)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/NAME.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

<!-- IDENTITY — the meta facts in one scannable block, richer than badges. The three
     first-screen questions are answered by Purpose, "Included in nextrush", and Package type.
     Delete any row that genuinely doesn't apply. -->

|  |  |
| --- | --- |
| **Purpose** | `<PLACEHOLDER: one line — HTTP routing for NextRush apps>` |
| **Package type** | `<Core · Middleware · Registrar · Extension · Adapter · Tooling · Internal>` |
| **Status** | `<Stable ✅ · Beta 🚧 · Experimental 🧪 · Deprecated ⚠️>` |
| **Included in `nextrush`?** | `<✅ Yes — re-exported | ❌ No — standalone install>` |
| **Support tier** | `<Public — stable>` (sealed public API) — see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | `<Active · Security-only · LTS · Deprecated>` |
| **Runtime** | Universal — Node · Bun · Deno · Edge |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v<x.y.z>` |

## Highlights

<!-- DIFFERENT from Identity — the qualities that sell the package, not its meta facts.
     No overlap with the runtime/type rows above. -->

- ✅ **Zero runtime dependencies** <!-- or: peer-depends on X — be honest -->
- ✅ **ESM-only**, tree-shakable, side-effect-free
- ✅ **Fully typed** — strict TypeScript, zero `any`
- 📦 **Bundle:** ~`<X>` KB min+gzip

<details>
<summary><strong>Table of contents</strong></summary>

<!-- (Tier 1 only) anchors = heading lowercased, spaces → hyphens -->
[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [API overview](#api-overview) · [Options](#options) · [Performance](#performance) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

<!-- (Tier 1–2) Storytelling shape: the pain → why the by-hand/existing approach hurts → the code
     that's easy to get wrong today. Concrete, in the reader's terms. -->

<PLACEHOLDER: the concrete pain, and why the obvious approach hurts as things grow.>

```ts
// TODAY, without this package — the thing that's easy to get wrong:
```

## When to use

<!-- (Tier 1–2) Kills confusion (e.g. @nextrush/core vs nextrush). Honest routing away when it's the wrong fit. -->

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

<!-- Keep momentum: install → import → run. -->

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

<PLACEHOLDER: one sentence — what just happened, and why it's this small.>

## Capabilities

<!-- (Tier 1–2) Was "Features". CATEGORIZE — don't dump a flat list. Drop a category that doesn't apply. -->

**Capabilities**
- **<Capability>** — <one line>
- **<Capability>** — <one line>

**Performance**
- **<Property>** — <one line> <!-- omit for non-perf packages -->

**Developer experience**
- **<Property>** — <e.g. fully typed · tree-shakable · zero-config>

## Mental model

<!-- (Tier 1–2) ONE diagram, ONE sentence, ONE rule — never more. ASCII only (Mermaid does NOT render on npm). -->

<PLACEHOLDER: the core idea in plain language.>

```text
request ──▶ <this package> ──▶ ctx.<result>
                │
                └─ <the key internal step>
```

**Rule:** <PLACEHOLDER: the one thing to remember.>

> [!TIP]
> The full request lifecycle (Mermaid) is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

<!-- (Tier 1–2) Was "Usage". One subsection per real task, common → advanced. People search by task. -->

### <PLACEHOLDER: task 1>

```ts
```

### <PLACEHOLDER: task 2>

```ts
```

## API overview

<!-- The sealed public surface only (ADR-0005). "Since" tracks when an export landed; "Stability"
     future-proofs the surface as it grows. -->

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `<name>` | `(<args>) => <ret>` | `<x.y.z>` | Stable ✅ | <what it does> |
| `type <Name>` | — | `<x.y.z>` | Stable ✅ | <what it types> |

## Options

<!-- (Tier 1–2) Mark required and security-sensitive rows explicitly. Zero-config? Replace the table
     with "No configuration — <why>". -->

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `<opt>` | `<type>` | <Yes/No> | `<default>` | <⚠️ / —> | <effect> |

## Performance

<!-- CONDITIONAL — include ONLY for perf-relevant packages: router · core · body-parser · serializer ·
     static · adapters · compression · stream. For everything else, DELETE this whole section
     (heading included). Claims must be backed by apps/benchmark. -->

<PLACEHOLDER: measured characteristics from apps/benchmark (baseline vs result, hardware noted).>

## Compatibility

<!-- Split into three DISTINCT relationships — don't mix them. -->

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | ESM-only |
| Bun / Deno / Edge | ✅ / ✅ / ✅ | via `@nextrush/adapter-*`, pinned by conformance |

**Integration**
- **Peer dependencies:** `<none | @nextrush/<x>>`
- **Works with:** `<e.g. runs after @nextrush/body-parser>`
- **Incompatible with:** `<none | @nextrush/<y> (both set the same header)>`

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CJS consumers can
> `require()` this ESM package natively. See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

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

<!-- (Tier 1–2) EXACTLY 4 real questions — prevents repeat GitHub issues without becoming a wall. -->

**<PLACEHOLDER: e.g. Can I use this without `nextrush`?>**
<answer>

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun / Deno / Edge?**
<answer>

**<PLACEHOLDER: fourth real question>**
<answer>

---

## Package relationships

<!-- ⭐ Three DISTINCT relationships — keep them separate. This is what orients a package in a
     30+ package ecosystem. -->

```text
                 depends on            @nextrush/<lower>
@nextrush/NAME ──────────────▶
                 often used with       @nextrush/<sibling>
                 usually used next     @nextrush/<next>
```

- **Depends on:** [`@nextrush/<x>`](../<path>) — <why>
- **Often used with:** [`@nextrush/<y>`](../<path>) — <why>
- **Usually used next:** [`@nextrush/<z>`](../<path>) — <why>
- **Alternative:** `<none | @nextrush/<alt> — when to prefer it>`

## Architecture

Maintaining or contributing to this package? The internal design — module layout, request
lifecycle, invariants, decisions and trade-offs (with diagrams) — is in
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
<PLACEHOLDER: link `docs/RFC/...` / `docs/adr/...`>.

## Resources

<!-- Was "Need help?" — GitHub Issues is reporting, not help. Verified links only; never link a
     dead channel (repo currently has NO Discord and Discussions is disabled). -->

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md) <!-- always link for an npm package -->
- 🔀 **Migration** — <PLACEHOLDER: link the migration guide when a major lands, else delete>
- 🧪 **Examples** — <PLACEHOLDER: example apps that use this, e.g. Blog API · Todo API, else delete>
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)

<!-- ✅ Before publishing: run the done-checklist in ./package-readme-authoring-guide.md.
     Key npm traps: no Mermaid, no relative images, absolute badge URLs, Quick start fully runnable.
     First screen must answer: what is this · do I install it or is it in nextrush · where does it fit. -->
