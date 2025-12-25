# 🚀 NextRush v3 CI/CD & Publishing Strategy

## 🏗️ The Challenge: Managing 20+ Packages
With a modular monorepo, manual publishing is impossible. We need a robust, automated system to handle versioning, testing, and deployment.

## 🛠️ Tooling Stack
- **Turborepo**: For fast, cached builds and test execution.
- **Changesets**: For managing versioning and changelogs in a monorepo.
- **GitHub Actions**: For automation.
- **pnpm**: For efficient workspace management.

## 🔄 The Workflow

### 1. Development (PR Phase)
- **Lint & Typecheck**: Ensure code quality.
- **Unit Tests**: Run all package tests in parallel via Turbo.
- **Changeset Check**: Require a changeset file for every PR that modifies a package.

### 2. Versioning (The "Version" PR)
- When ready to release, run `pnpm changeset version`.
- This automatically updates `package.json` versions and generates `CHANGELOG.md` files.
- A "Version Packages" PR is created.

### 3. Publishing (The Release)
- Once the Version PR is merged to `main`:
- GitHub Action runs `pnpm changeset publish`.
- Packages are published to npm.
- GitHub Releases are created automatically.

## 🤖 GitHub Actions Plan

### `ci.yml` (On every PR)
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm build
      - run: pnpm lint
      - run: pnpm test
```

### `release.yml` (On merge to main)
```yaml
name: Release
on:
  push:
    branches: [main]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install
      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 📦 Deployment Strategy (Apps)
- **Docs Site**: Auto-deploy to GitHub Pages or Vercel on every push to `main`.
- **Playground**: Deploy as a demo app to show off performance.

## 📅 Release Tiers
1. **Alpha (Current)**: `3.0.0-alpha.x` - Internal testing, breaking changes expected.
2. **Beta**: `3.0.0-beta.x` - Feature complete, bug fixing, public testing.
3. **RC (Release Candidate)**: `3.0.0-rc.x` - Final polish, no new features.
4. **Stable (GA)**: `3.0.0` - Production ready.

## 🛠️ Management Tips
- **Turbo Cache**: Use Remote Caching (Vercel) to speed up CI.
- **Strict Peer Deps**: Ensure packages work together correctly.
- **Automated Dependency Updates**: Use Renovate or Dependabot.
