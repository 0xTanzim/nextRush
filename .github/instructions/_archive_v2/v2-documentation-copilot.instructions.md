# NextRush v2 — Documentation Instructions

Purpose

- Provide one clear way to write docs for NextRush v2.
- Make docs easy to read, easy to copy/paste, and production-ready.
- Keep a consistent style so we can publish as a website later without rewrites.

Who this is for

- Contributors writing docs for features, APIs, guides, and examples.
- Reviewers maintaining consistency and quality.

Core goals

- Clarity first: aim for Flesch Reading Ease 85+.
- Beginner friendly: assume no prior framework knowledge.
- Practical: every page should help someone ship code today.
- Precise and truthful: no hype, no fluff, no ambiguity.

Voice and tone (follow these)

- Be clear and direct. Use plain English.
- Write in active voice.
- Use “you” and “your.”
- Keep sentences short. Cut filler.
- Use jargon only when it helps.
- Casual and confident is fine. Not salesy.
- Avoid clichés, hashtags, emojis, and semicolons in prose.
- Be certain when possible (avoid “might/could”).
- No repetition.

Content types

- Getting Started: shortest path to Hello World.
- How-to Guides: task-based steps with code.
- Concepts: explain ideas with simple examples.
- Reference (API): factual, exhaustive, skimmable.
- Tutorials: end-to-end builds with checkpoints.
- Troubleshooting: symptoms, causes, fixes.
- Release Notes/Changelog: what changed and actions to take.

Repository layout for docs

- docs/
  - README.md (docs home)
  - guides/ (how-to, tutorials, migration)
  - api/ (reference: application, context, routing, middleware, plugins)
  - architecture/ (design docs, deep dives)
  - plugins/ (each plugin’s docs)
  - examples/ (runnable, minimal examples)
  - images/ (diagrams and assets)

File naming

- Use kebab-case. Example: getting-started.md, routing.md
- One topic per file.
- Keep titles unique and descriptive.

General page template

- Title: one line, clear
- Summary: 1–3 lines, what the reader will get
- Prerequisites: minimal list
- Quick Start or Short Answer: show the working thing first
- Steps or Explanation: ordered sections
- Complete example: copy-paste runnable code
- Pitfalls and Gotchas: short bullets
- See also: related links
- Version tags (if needed): Added in vX.Y.Z, Breaking in vX.Y.Z

API reference page template (one unit per page when possible)

- What it is: 1–3 lines
- When to use: short bullets
- Signature: TypeScript signature
- Parameters: name, type, required, description
- Returns: type and meaning
- Errors: named errors and when they occur
- Examples: minimal and complete
- Performance notes: only if relevant
- Security notes: only if relevant
- See also: related APIs
- Version: introduced, changed

Writing rules for examples

- Always use TypeScript. Target Node.js >= 18.
- Prefer ESM imports.
- No any. Strong types only.
- Show minimal runnable examples (no placeholders).
- Use Koa-style context with Express-like helpers, matching NextRush v2.
- Handle errors safely (don’t leak sensitive data).
- Keep examples short, then link to a complete version.

Code style for docs examples

- Use TypeScript in fenced blocks.
- Prefer small files with one purpose.
- Name variables clearly. Avoid magic numbers/strings.
- Add comments only when it clarifies intent.

Runnable snippet standard

- Provide a minimal server + one route.
- Include startup instructions.
- Use default exports where it simplifies.

Minimal example (server)

```typescript
// app.ts
import { createApp } from 'nextrush'; // adjust to actual import path
import type { Context, Middleware } from 'nextrush/types';

const timing: Middleware = async (ctx: Context, next) => {
  const start = performance.now();
  await next();
  const ms = Math.round(performance.now() - start);
  ctx.res.set('X-Response-Time', `${ms}ms`);
};

const app = createApp();
app.use(timing);

app.get('/hello', async ctx => {
  ctx.body = { message: 'Hello, NextRush v2' };
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

Run

```bash
node app.ts
# or if compiling: tsx app.ts
```

API example pattern

```typescript
// get-user.ts
import { createApp } from 'nextrush';
import type { Context } from 'nextrush/types';

const app = createApp();

app.get('/users/:id', async (ctx: Context) => {
  const { id } = ctx.params;
  if (!id) {
    ctx.res.status(400).json({ error: 'Missing user id' });
    return;
  }
  // Simulated lookup
  const user = { id, name: 'Ada Lovelace' };
  ctx.res.json(user);
});

export default app;
```

Security in examples

- Validate inputs (use zod in examples where appropriate).
- Return safe error messages. Avoid leaking internal details.
- Don’t hardcode secrets. Don’t include tokens in examples.

Performance in examples

- Show efficient patterns (e.g., Maps for O(1) lookup).
- Avoid unnecessary allocations.
- Add notes when code trades readability for speed.

Cross-linking

- Link related docs with relative paths.
- Use “See also” at the end of pages.
- Keep link text descriptive (avoid “click here”).

Images and diagrams

- Prefer simple diagrams. Use alt text.
- Keep file sizes small. Place in docs/images/.

Common sections to include

- Before you begin
- Quick start
- Examples
- Pitfalls
- FAQ (only if it prevents repetition)
- See also

Do / Don’t

- Do: show the simplest working path first.
- Do: keep prose short and concrete.
- Do: explain the why when it prevents misuse.
- Don’t: combine multiple features in one example unless teaching composition.
- Don’t: write speculative language.

Public API documentation rules

- Every public API must have:
  - Clear description and when to use it
  - TypeScript signature(s) with types
  - Parameters, returns, and errors
  - At least one copy-paste example
  - Notes on performance or security if relevant
  - Version introduced (and breaking changes if any)

Front matter (optional, for site generators)

```markdown
---
title: Routing
description: Define routes with Koa-style context and Express-like helpers.
tags: [routing, core]
status: stable
since: 2.0.0-alpha.1
---
```

Troubleshooting template

- Symptom: brief description
- Likely cause: concise bullets
- Fix: exact steps or code
- Example: minimal reproducible snippet

Review checklist (use for every PR)

- Title and summary are clear
- Flesch score ~85+ (plain, short sentences)
- One topic per page
- Runnable example included
- TypeScript only (no any)
- Inputs validated or noted
- Errors safe and actionable
- Links resolve and are relevant
- Version info present (if API)
- No repetition, no fluff

Tooling (optional but recommended)

- markdownlint: enforce basic Markdown style
- remark-lint: broken links, formatting
- retext and retext-readability: catch complex sentences
- alex: catch insensitive language

Example npm scripts

```json
{
  "scripts": {
    "docs:lint:md": "markdownlint '**/*.md' --ignore node_modules",
    "docs:lint:remark": "remark . -qf",
    "docs:readability": "retext -u retext-readability -q **/*.md"
  }
}
```

Quality bar

- Docs must be correct, runnable, and easy to follow.
- Examples must compile and run on Node 18+.
- API docs must be complete and consistent.
- If a concept is complex, write a “Short Answer” first.

Last notes

- Prefer showing over telling.
- Optimize for developer experience.
- Keep improving examples based on real questions.
