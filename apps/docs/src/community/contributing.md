---
title: Contributing
description: How to contribute to NextRush — code, documentation, or feedback.
---

# Contributing to NextRush

Thank you for considering contributing to NextRush! This guide will help you get started.

## Ways to Contribute

### 🐛 Report Bugs

Found a bug? Open an issue with:

1. **Title**: Clear, descriptive summary
2. **Description**: What happened vs. what you expected
3. **Reproduction**: Minimal code to reproduce
4. **Environment**: Node.js version, OS, package versions

```bash
# Include this output in your issue
node -v
npm -v
pnpm nextrush --version
```

### 💡 Request Features

Have an idea? Open a discussion or issue with:

1. **Problem**: What problem are you solving?
2. **Solution**: How should it work?
3. **Alternatives**: What else did you consider?
4. **Use Case**: Real-world example

### 📖 Improve Documentation

Documentation PRs are always welcome:

- Fix typos and grammar
- Add missing examples
- Clarify confusing sections
- Translate to other languages

### 🔧 Submit Code

Fix bugs or add features through pull requests.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git

### Clone and Install

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/nextrush.git
cd nextrush
pnpm install
```

### Build

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @nextrush/core build
```

### Test

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @nextrush/core test

# Run tests in watch mode
pnpm --filter @nextrush/core test:watch
```

### Type Check

```bash
# Type check all packages
pnpm typecheck

# Type check specific package
pnpm --filter @nextrush/core typecheck
```

### Lint and Format

```bash
# Lint
pnpm lint

# Format
pnpm format
```

## Project Structure

```
nextrush/
├── packages/
│   ├── core/         # @nextrush/core
│   ├── router/       # @nextrush/router
│   ├── types/        # @nextrush/types
│   ├── errors/       # @nextrush/errors
│   ├── di/           # @nextrush/di
│   ├── decorators/   # @nextrush/decorators
│   ├── adapters/     # Platform adapters
│   ├── middleware/   # Official middleware
│   └── plugins/      # Official plugins
├── apps/
│   ├── docs/         # Documentation site
│   └── playground/   # Development playground
└── draft/            # Architecture planning
```

## Pull Request Process

### 1. Create a Branch

```bash
# From main branch
git checkout -b feat/your-feature
# or
git checkout -b fix/your-bug-fix
```

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/description` | `feat/websocket-support` |
| Bug fix | `fix/description` | `fix/router-params` |
| Docs | `docs/description` | `docs/middleware-guide` |
| Refactor | `refactor/description` | `refactor/core-cleanup` |

### 2. Make Changes

- Write clean, readable code
- Add tests for new functionality
- Update documentation as needed
- Follow existing code style

### 3. Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructure
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**

```bash
feat(router): add wildcard route support

fix(core): handle async errors in middleware

docs(middleware): add CORS configuration examples

test(di): add container injection tests
```

### 4. Submit PR

1. Push your branch
2. Open a Pull Request against `main`
3. Fill out the PR template
4. Wait for review

### PR Checklist

Before submitting:

- [ ] Tests pass (`pnpm test`)
- [ ] Types check (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Documentation updated (if needed)
- [ ] Commits follow conventional format

## Code Guidelines

### TypeScript

- Use strict mode
- No `any` types (use `unknown` if needed)
- Export types explicitly
- Document public APIs with JSDoc

```typescript
// ✅ Good
export interface UserOptions {
  /** User's display name */
  name: string;
  /** Email address for notifications */
  email?: string;
}

// ❌ Bad
export interface UserOptions {
  name: any;
  email: any;
}
```

### Testing

- Write tests for new features
- Cover edge cases
- Use descriptive test names
- Keep tests focused

```typescript
// ✅ Good test name
it('should return 404 when user does not exist', async () => {
  // ...
});

// ❌ Bad test name
it('test user', async () => {
  // ...
});
```

### Documentation

- Write for humans, not machines
- Include code examples
- Explain "why", not just "what"
- Keep examples runnable

## Package Size Limits

Each package has a size target. Check before submitting:

| Package | Max LOC |
|---------|---------|
| `@nextrush/core` | 1,500 |
| `@nextrush/router` | 1,000 |
| `@nextrush/decorators` | 800 |
| `@nextrush/di` | 400 |
| `@nextrush/middleware/*` | 300 |

## Getting Help

### Questions?

- Open a [GitHub Discussion](https://github.com/nextrush/nextrush/discussions)
- Check existing issues and discussions first

### Stuck?

- Reach out in discussions
- We're happy to help!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to NextRush! 🚀
