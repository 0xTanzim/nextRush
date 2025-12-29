---
description: 'Content strategy and writing workflow for NextRush documentation. Defines the editorial process, content hierarchy, and decision frameworks for creating world-class developer documentation.'
applyTo: '**'
---

# NextRush Documentation Content Strategy

This instruction file guides the **content creation process** for NextRush documentation.

It complements `docs-site.instructions.md` (structure) and `nextrush-docs.instructions.md` (philosophy) with actionable writing workflows.

---

## Content Hierarchy

### Priority 1: Critical Path (Must Have Day 1)

These pages determine whether developers adopt NextRush:

| Page | Purpose | Success Metric |
|------|---------|----------------|
| `getting-started/introduction.md` | Sell the vision | Time on page > 2 min |
| `getting-started/quick-start.md` | First success | < 5 min to working app |
| `concepts/context.md` | Core mental model | Reduces "how do I..." issues |
| `concepts/middleware.md` | Understand the flow | Enables custom middleware |

### Priority 2: Core Understanding (Week 1)

These pages enable productive development:

- `concepts/application.md`
- `concepts/routing.md`
- `concepts/plugins.md`
- `guides/rest-api.md`
- All middleware package docs

### Priority 3: Advanced Usage (Month 1)

These pages serve power users:

- `guides/authentication.md`
- `guides/database.md`
- `guides/testing.md`
- `guides/deployment.md`
- Plugin development guides

### Priority 4: Reference (Ongoing)

These pages are looked up, not read:

- `api/*.md`
- `packages/*.md` (detailed sections)
- TypeScript type definitions

---

## Content Decision Framework

### When to Write a New Page

Ask these questions:

1. **Is this a distinct concept?** → New concept page
2. **Is this a multi-step process?** → New guide/tutorial
3. **Is this package-specific?** → Add to package docs
4. **Is this a common question?** → FAQ or troubleshooting
5. **Is this API reference?** → API docs

### When to Update vs. Create

| Situation | Action |
|-----------|--------|
| New feature in existing package | Update package page |
| Breaking change | Update + migration guide |
| Common question pattern | Add to troubleshooting |
| Entirely new concept | New concept page |
| New integration pattern | New guide |

### Content Length Guidelines

| Content Type | Length | Why |
|-------------|--------|-----|
| Introduction | 500-800 words | Set the stage, don't overwhelm |
| Concept page | 800-1500 words | Teach one thing well |
| Tutorial | 1500-2500 words | Step-by-step needs detail |
| Package docs | 1000-2000 words | Complete reference |
| API reference | Per-function | Lookup, not reading |

---

## Writing Workflow

### Phase 1: Research (Before Writing)

Before writing any documentation page:

1. **Read the source code** - Understand what actually happens
2. **Find existing issues** - What confuses people?
3. **Check competing docs** - How do Express, Koa, Fastify explain this?
4. **Identify the pain** - What problem does this solve?

### Phase 2: Outline (Structure First)

Create an outline following the template:

```markdown
# [Title]

## The Problem
- Pain point 1
- Pain point 2

## Mental Model
- Key insight
- Analogy if helpful

## Basic Usage
- Minimal example

## How It Works
- Step 1
- Step 2
- Step 3

## Common Patterns
- Pattern 1
- Pattern 2

## Common Mistakes
- Mistake 1
- Mistake 2

## When NOT to Use
- Misuse case 1
```

### Phase 3: First Draft (Get It Down)

Write without editing:
- Focus on explaining, not polishing
- Include all code examples (even if rough)
- Mark uncertain areas with `[TODO: verify]`

### Phase 4: Technical Review

Verify:
- [ ] Code examples run correctly
- [ ] API signatures match implementation
- [ ] Default values are accurate
- [ ] Performance claims are tested

### Phase 5: Editorial Review

Check:
- [ ] No forbidden phrases
- [ ] Active voice throughout
- [ ] Consistent terminology
- [ ] Appropriate length
- [ ] Clear next steps

### Phase 6: User Testing

Ideal: Have someone unfamiliar with the feature:
1. Read the page
2. Try to implement the feature
3. Note where they got stuck
4. Revise based on feedback

---

## Terminology Consistency

### Official Terms

Use these exact terms consistently:

| Term | Use | Don't Use |
|------|-----|-----------|
| Context | `ctx` | request context, req/res |
| Middleware | middleware | handler, interceptor |
| Plugin | plugin | extension, module |
| Handler | handler | controller, endpoint |
| Route | route | path, endpoint |
| Application | app, Application | server, instance |

### Capitalization

| Term | Capitalization |
|------|---------------|
| NextRush | Always capitalized |
| Context | Capitalize when noun, lowercase in code |
| JavaScript | Always capitalized |
| TypeScript | Always capitalized |
| Node.js | Always with `.js` |
| npm/pnpm | Always lowercase |

### Code Conventions

```typescript
// Variable naming in examples
const app = createApp();           // Always 'app'
const router = createRouter();     // Always 'router'
const ctx = ...;                   // Always 'ctx'
const middleware = ...;            // Describe the purpose

// Function naming in examples
async function handleUsers(ctx) {} // Descriptive handlers
async function authMiddleware(ctx) {} // Middleware naming
```

---

## Code Example Standards

### Example Categories

1. **Minimal Examples** - Prove a concept works
2. **Practical Examples** - Show real-world usage
3. **Complete Examples** - Production-ready code

### Minimal Example

```typescript
// Purpose: Show ctx.json() works
import { createApp } from '@nextrush/core';

const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello' });
});
```

### Practical Example

```typescript
// Purpose: Show a realistic use case
import { createApp } from '@nextrush/core';
import { json } from '@nextrush/body-parser';

const app = createApp();

app.use(json());

app.post('/users', async (ctx) => {
  const { name, email } = ctx.body;

  // Validate
  if (!name || !email) {
    ctx.status = 400;
    ctx.json({ error: 'Name and email required' });
    return;
  }

  // Create user (simulated)
  const user = { id: Date.now(), name, email };

  ctx.status = 201;
  ctx.json({ user });
});
```

### Complete Example

```typescript
// Purpose: Production-ready reference
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { json } from '@nextrush/body-parser';
import { cors } from '@nextrush/cors';
import { helmet } from '@nextrush/helmet';
import { rateLimit } from '@nextrush/rate-limit';

const app = createApp();
const router = createRouter();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS }));
app.use(rateLimit({ max: 100, window: '15m' }));

// Body parsing
app.use(json({ limit: '1mb' }));

// Request logging
app.use(async (ctx) => {
  const start = Date.now();
  await ctx.next();
  console.log(`${ctx.method} ${ctx.path} ${ctx.status} ${Date.now() - start}ms`);
});

// Routes
router.get('/health', (ctx) => {
  ctx.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

router.get('/users/:id', async (ctx) => {
  const { id } = ctx.params;
  const user = await db.users.findById(id);

  if (!user) {
    ctx.status = 404;
    ctx.json({ error: 'User not found' });
    return;
  }

  ctx.json({ user });
});

router.post('/users', async (ctx) => {
  const { name, email } = ctx.body;

  if (!name || !email) {
    ctx.status = 400;
    ctx.json({ error: 'Name and email are required' });
    return;
  }

  const user = await db.users.create({ name, email });

  ctx.status = 201;
  ctx.json({ user });
});

// Mount router
app.use(router.routes());

// Error handling
app.use(async (ctx) => {
  try {
    await ctx.next();
  } catch (error) {
    console.error('Unhandled error:', error);
    ctx.status = 500;
    ctx.json({ error: 'Internal server error' });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
```

---

## Error Message Documentation

### Documenting Errors

Every error a user might encounter should be documented:

```markdown
### "Cannot read properties of undefined (reading 'body')"

**Cause:** You're accessing `ctx.body` without using a body parser.

**Solution:**

```typescript
import { json } from '@nextrush/body-parser';

app.use(json()); // Add this before your routes

app.post('/users', async (ctx) => {
  const data = ctx.body; // Now works
});
```
```

### Error Documentation Checklist

- [ ] Error message quoted exactly
- [ ] Cause explained simply
- [ ] Solution with working code
- [ ] Related errors linked

---

## Migration Guide Standards

When documenting migrations between versions:

### Structure

```markdown
# Migrating from v[X] to v[Y]

## Breaking Changes

### 1. [Change Name]

**Before (v[X]):**
```typescript
// Old code
```

**After (v[Y]):**
```typescript
// New code
```

**Why this changed:** [Brief explanation]

**Migration steps:**
1. Step 1
2. Step 2
3. Step 3

### 2. [Next Change]

[Same structure]

## Deprecations

| Deprecated | Replacement | Removal Version |
|------------|-------------|-----------------|
| `oldMethod()` | `newMethod()` | v4.0.0 |

## New Features

[Brief overview with links to full docs]

## Need Help?

- [GitHub Discussions](link)
- [Migration FAQ](link)
```

---

## Search Optimization

### Page Titles

- Use descriptive, searchable titles
- Include the feature name
- Keep under 60 characters

Good: "Body Parser - Parse JSON and Form Data"
Bad: "Request Body Handling"

### Headings

- Use question-based headings when appropriate
- Include keywords users search for

Good: "How do I parse JSON request bodies?"
Bad: "JSON Parsing"

### Content Keywords

Include natural variations of terms:
- "parse JSON" / "JSON parsing" / "JSON body"
- "authentication" / "auth" / "login"
- "database" / "DB" / "data storage"

---

## Accessibility Standards

### Alt Text for Images

```markdown
![Middleware execution flow: Request enters from left, passes through middlewares 1, 2, 3 to handler, then back through 3, 2, 1 to response](./middleware-flow.png)
```

### Code Block Labels

Always include language identifier:

```typescript
// Not just ```
```

### Link Text

Good: "Learn about [middleware composition](link)"
Bad: "Click [here](link) to learn more"

---

## Review Checklist

### Self-Review

Before requesting review:

- [ ] Spellcheck passed
- [ ] All code examples tested
- [ ] Links verified
- [ ] Follows template structure
- [ ] No forbidden phrases
- [ ] Consistent terminology

### Peer Review Focus

Reviewers should check:

- [ ] Technical accuracy
- [ ] Completeness for the target audience
- [ ] Clarity of explanations
- [ ] Code example correctness
- [ ] Consistency with existing docs

### Final Review

Before publishing:

- [ ] Cross-links to related pages added
- [ ] Table of contents updated (if auto-generated)
- [ ] Changelog entry added (for significant changes)
- [ ] Search keywords verified

---

## Continuous Improvement

### Feedback Sources

Monitor and incorporate:

1. **GitHub Issues** - "how do I..." questions
2. **GitHub Discussions** - common confusions
3. **Search Analytics** - what people can't find
4. **User Feedback** - "was this helpful?" ratings

### Quarterly Review

Every quarter:

1. Review most-visited pages for staleness
2. Check for outdated code examples
3. Update version numbers
4. Remove deprecated patterns
5. Add new common questions

### Community Contributions

When accepting community docs contributions:

1. Apply same quality standards
2. Ensure consistent voice/tone
3. Verify technical accuracy
4. Credit contributors appropriately

---

## Final Principles

1. **Write for the frustrated developer at 2 AM** - Clear, direct, no fluff
2. **Assume intelligence, not knowledge** - Explain concepts, not condescend
3. **Show, then tell** - Code first, explanation second
4. **One page, one purpose** - Don't overload pages
5. **Update ruthlessly** - Stale docs are worse than no docs

The goal is not comprehensive documentation.
The goal is **effective** documentation.

Every word must earn its place.
