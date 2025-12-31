---
title: Examples
description: Complete, runnable examples showcasing NextRush patterns and best practices.
---

# Examples

Complete, runnable examples you can copy and adapt for your projects.

## Quick Start Examples

<div class="grid">

<a href="/examples/hello-world" class="card">
<h3>👋 Hello World</h3>
<p>The simplest NextRush application — get running in 30 seconds.</p>
<span class="badge">Beginner</span>
</a>

<a href="/examples/rest-crud" class="card">
<h3>📝 REST CRUD API</h3>
<p>Complete CRUD operations with validation, error handling, and proper HTTP semantics.</p>
<span class="badge">Intermediate</span>
</a>

<a href="/examples/class-based-api" class="card">
<h3>🏗️ Class-Based API</h3>
<p>Structured API using controllers, dependency injection, and decorators.</p>
<span class="badge">Intermediate</span>
</a>

</div>

## Example Categories

### Functional Style

These examples use the minimal, function-based approach:

- **[Hello World](/examples/hello-world)** — Simplest possible app
- **[REST CRUD](/examples/rest-crud)** — Full CRUD with routing

### Class-Based Style

These examples use controllers and dependency injection:

- **[Class-Based API](/examples/class-based-api)** — Controllers, DI, guards

## Running Examples

All examples can be run with:

```bash
# Create a new directory
mkdir my-example && cd my-example

# Initialize package.json
pnpm init

# Install NextRush
pnpm add nextrush

# Create the example file and run
npx nextrush dev
```

## Example Structure

Each example includes:

- **Complete Code** — Copy-paste ready
- **Step-by-Step Explanation** — What each part does
- **Test Commands** — curl commands to verify
- **Next Steps** — Where to go from here

<style>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.card {
  display: block;
  padding: 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
  position: relative;
}

.card:hover {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-bg-soft);
}

.card h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: var(--vp-c-text-1);
}

.card p {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}

.badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand);
}
</style>
