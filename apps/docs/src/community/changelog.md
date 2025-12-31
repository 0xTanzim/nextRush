---
title: Changelog
description: NextRush version history and release notes.
---

# Changelog

All notable changes to NextRush are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and NextRush adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation site with VitePress
- Examples: Hello World, REST CRUD, Class-Based API

---

## [3.0.0-alpha.2] - 2025-01-XX

### Added
- **@nextrush/controllers**: Controllers plugin with auto-discovery
- **@nextrush/di**: Dependency injection container with `@Service`, `@Repository`
- **@nextrush/decorators**: Controller and route decorators
  - Class decorators: `@Controller`, `@UseGuard`
  - Route decorators: `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`
  - Parameter decorators: `@Body`, `@Param`, `@Query`, `@Headers`, `@State`, `@Ctx`
  - Transform support for parameter validation
- **Guard system**: Function-based and class-based guards with DI support

### Changed
- Middleware syntax now uses `ctx.next()` instead of separate `next` parameter
- Context API redesigned for better DX

### Breaking Changes
- Controllers require `reflect-metadata` and TypeScript decorator options
- Middleware signature changed: `(ctx, next) => {}` → `(ctx) => { await ctx.next() }`

---

## [3.0.0-alpha.1] - 2025-01-XX

### Added
- **@nextrush/core**: New minimal core (~1,500 LOC)
  - `createApp()` factory function
  - Plugin system with `app.plugin()`
  - Middleware composition with `compose()`
- **@nextrush/router**: Radix tree router
  - High-performance route matching
  - Route parameters with `:param` syntax
  - Wildcard routes with `*`
- **@nextrush/types**: Shared TypeScript types
- **@nextrush/errors**: HTTP error hierarchy
  - `HttpError`, `BadRequestError`, `UnauthorizedError`, etc.
- **@nextrush/adapter-node**: Node.js HTTP adapter
- **@nextrush/body-parser**: JSON and URL-encoded body parsing
- **@nextrush/cors**: CORS middleware
- **@nextrush/helmet**: Security headers middleware
- **@nextrush/rate-limit**: Rate limiting middleware
- **@nextrush/dev**: Development CLI with hot reload

### Changed
- Complete architecture rewrite from monolithic v2
- Modular monorepo structure with separate packages
- Package imports now use `@nextrush/*` scope

### Migration from v2
See [Migration Guide](/guides/migration-v2) for upgrading from v2.

---

## Previous Versions

For v2.x changelog, see the [v2 branch](https://github.com/nextrush/nextrush/blob/v2/CHANGELOG.md).

---

## Version Policy

### Semantic Versioning

NextRush uses semantic versioning:

- **Major (X.0.0)**: Breaking changes
- **Minor (0.X.0)**: New features, backwards compatible
- **Patch (0.0.X)**: Bug fixes, backwards compatible

### Pre-release Versions

- **alpha**: Early development, expect breaking changes
- **beta**: Feature complete, stabilizing API
- **rc**: Release candidate, final testing

### LTS Policy

- **Current**: Latest version, all new features
- **Active LTS**: Maintenance releases for 12 months
- **End of Life**: No further updates

---

## Release Schedule

NextRush releases follow a predictable cadence:

| Type | Frequency |
|------|-----------|
| Patch | As needed |
| Minor | Monthly |
| Major | Annually |

---

## Deprecation Policy

1. Feature marked deprecated with warning
2. Deprecated for at least one minor version
3. Removed in next major version

Deprecated features are documented with migration paths.
