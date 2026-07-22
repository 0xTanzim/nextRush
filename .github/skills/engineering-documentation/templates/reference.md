{/*
  REFERENCE PAGE TEMPLATE — Diátaxis "reference". Standard: EDS-011.
  INVERTS the universal flow: facts-first, lookup-optimized, tables over prose, NO story.
  The 30-second rule: a developer must answer import? · signature? · params? · returns? · throws? ·
  constraints? · where next? without reading a paragraph. Every example is copy-paste-run (no `...`,
  no pseudo-code). Prefer <AutoTypeTable>/<TypeTable> for structured types (EDS-016) to kill drift.
*/}
---
title: {{ API / function / class name — exact, e.g. "createApp()" }}
description: {{ 120–160 chars — what it does, for search }}
---

{{ 1 sentence: what this is. Link the concept in one line if understanding is needed — don't teach it. }}

## Quick facts

| Property | Value |
| -------- | ----- |
| Package | `{{ @nextrush/core }}` |
| Since | `{{ 1.0.0 }}` |
| Stability | {{ Stable / Experimental / Deprecated }} |
| Runtime | {{ Node · Bun · Deno · Edge }} |
| Async | {{ Yes / No }} |
| Throws | {{ Yes / No }} |

## Import

```ts
import { {{ createApp }} } from '{{ nextrush }}';
```

## Signature

```ts
{{ exact, complete signature as developers write it }}
function createApp(options?: AppOptions): Application;
```

{/* If overloaded, show EVERY overload — don't hide them. */}
```ts
// Overloads
createApp();
createApp(options: AppOptions);
```

## Parameters

| Parameter | Type | Default | Description | Constraints |
| --------- | ---- | ------- | ----------- | ----------- |
| `{{ name }}` | `{{ type }}` | `{{ default }}` | {{ what it does }} | {{ e.g. "1–65535" }} |

{/* Document EVERY parameter/option — completeness beats selectivity (EDS-011). */}

## Returns

| Type | Description | Nullable | Throws |
| ---- | ----------- | -------- | ------ |
| `{{ type }}` | {{ meaning; special cases }} | {{ No }} | {{ Yes — see Errors }} |

## Properties

{{ OPTIONAL — only if the API exposes properties (e.g. a class). Omit the section otherwise. }}

| Property | Type | Description |
| -------- | ---- | ----------- |
| `{{ name }}` | `{{ type }}` | {{ … }} |

## Methods

{{ OPTIONAL — for a class/object, list methods so readers can navigate. Link each to its own page. }}

| Method | Signature | Description |
| ------ | --------- | ----------- |
| [`{{ get() }}`](/docs/reference/{{ slug }}) | `{{ (path, handler) => this }}` | {{ … }} |

## Behavior

{{ Split for scanning — no long paragraphs. }}

- **Execution:** {{ runs immediately / lazily; complexity where relevant, e.g. lookup O(1) }}
- **Lifecycle:** {{ when it's valid — e.g. "available after `ready()`; throws before" }}
- **Side effects:** {{ what state it changes — registers middleware, mutates the container, etc. }}

## Examples

<Tabs items={["Basic", "Advanced"]}>
<Tab value="Basic">

```ts
// {{ the typical call — copy-paste-run }}
```

</Tab>
<Tab value="Advanced">

```ts
// {{ a realistic advanced call — still complete and runnable }}
```

</Tab>
</Tabs>

## Errors

| Error | When | Recovery |
| ----- | ---- | -------- |
| `{{ ErrorType }}` | {{ the trigger }} | {{ the fix — engineers want the recovery, not just the error }} |

## Compatibility

{{ Runtimes and any constraint. Be explicit when something is Node-only. }}
- **Runtimes:** {{ Node · Bun · Deno · Edge }}

## Version notes

- **Since:** `{{ 1.0.0 }}`
- **Deprecated:** {{ version + replacement, or "—" }}
- **Removal:** {{ planned removal version, or "—" }}

## Related types

- [`{{ AppOptions }}`](/docs/reference/{{ slug }}) · [`{{ Context }}`](/docs/reference/{{ slug }})

## Related

- [{{ Concept }}](/docs/concepts/{{ slug }}) · [{{ Related API }}](/docs/reference/{{ slug }})
