---
title: Guides
description: Practical guides for building real-world applications with NextRush.
---

# Guides

Practical guides for building real-world applications with NextRush.

## Development & Build

Learn how to develop and deploy NextRush applications efficiently.

<div class="grid">

<a href="/guides/dev-tools" class="card">
<h3>⚡ Development Tools</h3>
<p>Use nextrush CLI for development and production builds with hot reload and decorator metadata support.</p>
</a>

<a href="/guides/class-based-development" class="card">
<h3>🏗️ Class-Based Development</h3>
<p>Build structured APIs with controllers, dependency injection, and decorators.</p>
</a>

</div>

## Building APIs

<div class="grid">

<a href="/guides/rest-api" class="card">
<h3>🛠️ REST APIs</h3>
<p>Build RESTful APIs with routing, validation, and error handling.</p>
</a>

<a href="/guides/authentication" class="card">
<h3>🔐 Authentication</h3>
<p>Implement authentication with guards, JWT tokens, and session management.</p>
</a>

</div>

## Quality & Deployment

<div class="grid">

<a href="/guides/testing" class="card">
<h3>🧪 Testing</h3>
<p>Write unit tests, integration tests, and mock dependencies effectively.</p>
</a>

<a href="/guides/error-handling" class="card">
<h3>⚠️ Error Handling</h3>
<p>Handle errors gracefully with HTTP error classes and global error handlers.</p>
</a>

</div>

## Recommended Learning Path

1. **[Development Tools](/guides/dev-tools)** — Set up your development environment
2. **[REST APIs](/guides/rest-api)** — Build your first API (functional approach)
3. **[Class-Based Development](/guides/class-based-development)** — Scale with controllers and DI
4. **[Authentication](/guides/authentication)** — Secure your endpoints
5. **[Testing](/guides/testing)** — Ensure code quality
6. **[Error Handling](/guides/error-handling)** — Handle failures gracefully

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
  margin: 0;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}
</style>
