{/*
  TUTORIAL PAGE TEMPLATE — Diátaxis "tutorial". Standard: EDS-008. Flow: EDS-006.
  A tutorial is a WORKSHOP with the teacher leading in a safe environment — NOT a Guide.
  Success is measured by the LEARNER ("I built it myself and understand each step"), not by the
  project. Loop per step: Why now → Do → Expected output → Explanation, one new idea per step,
  a Checkpoint every few steps. Front-matter required.

  difficulty/estimatedTime/prerequisites live in front-matter as the authoring standard. NOTE:
  the docs collection schema (apps/docs/source.config.ts) currently captures only title/description
  and strips the rest, so also surface them visibly under Prerequisites until the schema + a header
  component render them.
*/}
---
title: {{ "Build a ___" — the thing they'll create }}
description: {{ 120–160 chars — what they build and what they'll understand by the end }}
difficulty: {{ beginner | intermediate | advanced }}
estimatedTime: {{ e.g. "20 minutes" }}
prerequisites: [{{ "Routing", "Middleware" }}]
---

{{ One paragraph: what we're building and why it's worth the time. }}

## Finished project

{{ Show the DESTINATION first — the reader stays motivated when they can see where they're going. }}

By the end you'll have:
- ✓ {{ … }}

```bash
curl localhost:3000/{{ … }}
# {{ the actual response they'll get — proof of the destination }}
```

## Learning journey

{{ The steps as a progress checklist; readers love seeing "I'm halfway". }}
- ✓ {{ Step 1 — done as they read }}
- ⬜ {{ Step 2 }}
- ⬜ {{ Step 3 }}

## Prerequisites

- **Concepts:** [{{ concept }}](/docs/concepts/{{ slug }})
- **Required:** {{ Node >= 22, TypeScript basics }}
- **Difficulty · time:** {{ Beginner · ~20 minutes }}   {/* remove once front-matter renders */}

<Steps>

### Step 1 / {{ N }} — {{ imperative, e.g. "Create the app" }}

**Why now:** {{ why this step comes first — teaching order matters (EDS-005). }}

**Do:**

```ts title="src/app.ts"
import { createApp, listen } from 'nextrush';
// {{ small, complete, runnable — ONE new idea only }}
```

**Expected output:**

```text
{{ what they should see — server log, response — so they confirm success }}
```

**Why it worked:** {{ the one line that mattered and the mechanism behind it. }}

<Callout type="info">
Tip: {{ don't-memorize-this, notice-that… — a learning nudge for beginners }}
</Callout>

### Step 2 / {{ N }} — {{ next single idea }}

{{ Repeat Why now → Do → Expected output → Why it worked. Introduce exactly one new concept;
   link the concept page (EDS-007) for depth rather than teaching it in full here. }}

</Steps>

## Checkpoint

{{ After every few steps — reduces frustration by confirming a known-good state. }}

At this point:
- ✓ {{ … }}
- ✓ {{ … }}

Your project now looks like:

```text
src/
  app.ts
  routes/
    users.ts
```

Continue when everything above works.

{/* Repeat Steps + Checkpoint until the build is complete. */}

## Final project

{{ The complete file tree (and, for larger tutorials, the full code) so readers can compare. }}

```text
src/
  app.ts
  routes/
  middleware/
```

## What you learned

{{ Recap per idea: Concept → where you used it → why it matters. Not "congratulations". }}
- **{{ Concept }}** — you used it in {{ step }}; it matters because {{ … }}.

## Think about it

{{ Reflection questions that turn copying into understanding — almost no framework docs do this. }}
- Why did we {{ create the router before mounting it }}?
- Why didn't we {{ validate inside the router }}?

## Try it yourself

{{ A challenge so the reader thinks independently. Don't show the answer yet. }}
- ✓ {{ Add DELETE /users/:id }}
- ✓ {{ Return 404 when not found }}

<details>
<summary>Solution</summary>

```ts
// {{ complete, runnable solution }}
```

</details>

## Common mistakes

{{ Mistake → Symptom → Cause → Fix — tutorial readers recognize the symptom first. }}
- **{{ Mistake }}.** *Symptom:* {{ … }}. *Cause:* {{ … }}. *Fix:* {{ … }}.

## Next tutorial

{{ Point to the NEXT build, so it feels like a course — not just doc links. }}
<Cards>
  <Card title="{{ Next tutorial — e.g. Add authentication }}" href="/docs/start/{{ slug }}">
    {{ what they'll build next }}
  </Card>
</Cards>

## Continue learning

{{ Fixed order: Concept → Guide → Reference → Architecture. }}
<Cards>
  <Card title="{{ Concept }}" href="/docs/concepts/{{ slug }}" />
  <Card title="{{ Guide }}" href="/docs/guides/{{ slug }}" />
  <Card title="{{ Reference }}" href="/docs/reference/{{ slug }}" />
  <Card title="{{ Architecture }}" href="/docs/internals/{{ slug }}" />
</Cards>
