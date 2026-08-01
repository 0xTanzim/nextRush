{/*
  MIGRATION / VERSIONING TEMPLATE. Standard: EDS-020. Make an intimidating change feel safe, mechanical, finite.
  Lead with the breaking-changes table + an honest effort estimate. Before/after for every break. Include rollback.
*/}
---
title: {{ "Migrate from ___ to ___" (version upgrade or cross-tool) }}
description: {{ 120–160 chars — what's changing and who it affects }}
---

## Overview

{{ What's changing and why. Not a changelog — this page is about HOW to move, safely (EDS-020). }}

## Who needs to migrate

{{ Which readers are affected and which can skip this. }}

<Callout type="info">
**Effort estimate:** {{ honest, segmented — e.g. "Most apps: ~30 min. Apps using the plugin API: ~half a day." (EDS-020) }}
</Callout>

## Breaking changes

{{ Lead with this table (EDS-020) — every breaking change, scannable. }}

| Change | Affects | Action required |
| ------ | ------- | --------------- |
| `{{ what }}` | {{ who }} | {{ what to do }} |

## Step-by-step migration

<Steps>

### {{ Step }}

{{ Before/after for the change — the highest-value content (EDS-020). }}

```ts title="Before"
// {{ old }}
```

```ts title="After"
// {{ new }}
```

### {{ Next step }}

</Steps>

## Automated migration

{{ If a codemod exists: the exact command, and what it does and does NOT cover (EDS-020). }}

```bash
{{ npx ... }}
```

## Verify

{{ How to confirm the migration worked — tests pass, app boots, key flows respond. }}

## Rollback

<Callout type="warning">
{{ How to back out safely if something breaks — a reader is braver with a documented undo (EDS-020). }}
</Callout>

## Not yet supported

{{ Be honest about features with no equivalent yet, and the workaround. }}

## Getting help

- [{{ Issues }}]({{ link }}) · [{{ Discussions/community if it exists }}]({{ link }})
