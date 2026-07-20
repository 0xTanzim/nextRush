{/*
  REFERENCE PAGE TEMPLATE — Diátaxis "reference". Standard: EDS-011.
  INVERTS the universal flow: signature-first, lookup-optimized, tables over prose. No hook, no story.
  Prefer a <TypeTable> for structured params where your framework provides one (EDS-016).
*/}
---
title: {{ API / function / class name — exact, e.g. "createApp()" }}
description: {{ 120–160 chars — what it does, for search }}
---

{{ 1–2 sentences: what this is and when it's used. Link the concept page in one line if understanding is needed — don't teach it here (EDS-011). }}

## Signature

```ts
{{ exact, complete signature as developers write it }}
function createApp(options?: AppOptions): Application;
```

## Parameters

| Parameter | Type | Required | Default | Description |
| --------- | ---- | -------- | ------- | ----------- |
| `{{ name }}` | `{{ type }}` | {{ Yes/No }} | `{{ default }}` | {{ what it does; constraints }} |

{/* Document EVERY parameter/option — completeness beats selectivity here (EDS-011). */}

## Returns

| Type | Description |
| ---- | ----------- |
| `{{ type }}` | {{ meaning; special cases }} |

## Behavior

{{ Runtime behavior that matters: execution order, side effects, lifecycle, lazy evaluation. Concise. }}

## Example

```ts
// {{ ONE small, realistic, typical call (EDS-013) — anchors the signature, not a tutorial }}
```

## Errors

| Error | When |
| ----- | ---- |
| `{{ ErrorType }}` | {{ the condition that triggers it and how to avoid it }} |

## Notes

{{ Only API-relevant facts: performance, compatibility, deprecation, version-specific behavior. }}

## Related

- [{{ Concept }}](/concepts/{{ slug }}) · [{{ Related API }}](/reference/{{ slug }})
