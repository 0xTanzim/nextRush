# NextRush Agent Skills — Architecture Reference

> How NextRush skills are structured, discovered, installed, and used by AI agents.

---

## What Are Agent Skills?

Agent Skills are self-contained folders of instructions and optional resources that give AI coding agents new capabilities. They follow the [Agent Skills open standard](https://agentskills.io/specification) — originally developed by Anthropic and adopted by GitHub Copilot, OpenAI Codex, Claude, Cursor, Roo Code, Amp, Goose, and others.

A skill is **not** a library or an npm package. It is a folder containing a `SKILL.md` file with instructions that an AI agent reads to learn how to perform a specific task.

---

## Standard Locations

| Location                   | Platform       | Scope           |
| -------------------------- | -------------- | --------------- |
| `.github/skills/<name>/`   | GitHub Copilot | Repository      |
| `.claude/skills/<name>/`   | Claude Code    | Repository      |
| `.agents/skills/<name>/`   | OpenAI Codex   | Repository      |
| `~/.github/skills/<name>/` | GitHub Copilot | User (personal) |
| `~/.claude/skills/<name>/` | Claude Code    | User (personal) |
| `~/.agents/skills/<name>/` | OpenAI Codex   | User (personal) |

NextRush ships skills in **all three repository locations** for maximum compatibility.

---

## Directory Structure

```
nextrush-create-middleware/
├── SKILL.md              # Required — instructions + frontmatter
├── references/            # Optional — detailed docs loaded on demand
│   └── middleware-patterns.md
├── scripts/               # Optional — executable helpers
├── assets/                # Optional — static resources (templates, schemas)
└── templates/             # Optional — code scaffolding templates
```

---

## SKILL.md Format

### Frontmatter (Required)

```yaml
---
name: nextrush-create-middleware
description: >
  Build custom Koa-style async middleware for NextRush to intercept, transform,
  and control the HTTP request/response lifecycle. Use when creating logging,
  auth checks, rate limiting, error handling, or response transformation
  middleware. Supports ctx.next(), ctx.state, short-circuit patterns.
metadata:
  author: nextrush
  version: '1.0'
  package: core
---
```

| Field           | Required | Rules                                                                |
| --------------- | -------- | -------------------------------------------------------------------- |
| `name`          | Yes      | Lowercase + hyphens, max 64 chars. Must match parent directory name. |
| `description`   | Yes      | Max 1024 chars. Must describe WHAT + WHEN + KEYWORDS.                |
| `license`       | No       | License name or reference to bundled LICENSE file.                   |
| `compatibility` | No       | Max 500 chars. Environment requirements.                             |
| `metadata`      | No       | Arbitrary key-value map. We use `author`, `version`, `package`.      |
| `allowed-tools` | No       | Space-delimited pre-approved tools (experimental).                   |

### Description Rules

The `description` field is the **primary discovery mechanism**. Agents read only `name` + `description` at startup. The full SKILL.md body loads only when matched.

Write descriptions with three components:

1. **WHAT** — Capabilities the skill provides
2. **WHEN** — Trigger scenarios (use phrases like "Use when...")
3. **KEYWORDS** — Specific terms that help matching (API names, patterns, concepts)

### Body Content

The Markdown body contains the actual instructions. Recommended sections:

1. **Title** — `# Skill Title`
2. **When to Use** — Explicit trigger scenarios
3. **Prerequisites** — Required setup, imports, config
4. **Step-by-Step Workflows** — Imperative instructions with code
5. **Troubleshooting** — Common issues and solutions
6. **Rules** — Hard constraints the agent must follow

Keep under 500 lines. Move detailed reference material to `references/`.

---

## Progressive Loading

Skills use three-level progressive disclosure to manage context efficiently:

```
Level 1: Discovery (~100 tokens)
├── name + description loaded at startup for ALL skills
├── Agent decides whether to activate based on task match
│
Level 2: Instructions (<5000 tokens recommended)
├── Full SKILL.md body loaded when skill is activated
├── Contains step-by-step workflows and code examples
│
Level 3: Resources (on demand)
├── references/*.md loaded when agent needs detail
├── scripts/* executed when agent needs automation
└── assets/* used when agent needs templates/data
```

---

## Installation

### Via Vercel Skills CLI (Recommended)

```bash
npx skills add 0xTanzim/nextrush
```

This installs all NextRush skills to the current project.

### Manual Installation

Copy the skill folder to your preferred location:

```bash
# For GitHub Copilot
cp -r .github/skills/nextrush-create-middleware ~/.github/skills/

# For Claude Code
cp -r .claude/skills/nextrush-create-middleware ~/.claude/skills/

# For OpenAI Codex
cp -r .agents/skills/nextrush-create-middleware ~/.agents/skills/
```

### From the Docs Site

Visit [nextrush-docs-url/skills](/skills) to browse all available skills. Each skill page includes a JSON index at `/skills.json` for programmatic discovery.

---

## NextRush Skills Inventory

| Skill                        | Package    | Difficulty   | Description                                              |
| ---------------------------- | ---------- | ------------ | -------------------------------------------------------- |
| `nextrush-build-rest-api`    | router     | Beginner     | Functional routing, CRUD, query params, error handling   |
| `nextrush-create-middleware` | core       | Beginner     | Koa-style async middleware patterns                      |
| `nextrush-error-handling`    | errors     | Beginner     | HttpError hierarchy, error middleware, production safety |
| `nextrush-create-controller` | decorators | Intermediate | Decorator-based controllers, DI, guards, params          |
| `nextrush-setup-di`          | di         | Intermediate | Dependency injection, scopes, tokens, testing            |

---

## How Skills Are Used

### Automatic Discovery

When you open a project containing `.github/skills/` (or `.claude/skills/` or `.agents/skills/`), compatible AI agents automatically discover the skills. The agent reads the `name` and `description` fields from each `SKILL.md`.

### Implicit Activation

When your prompt matches a skill's description, the agent loads the full `SKILL.md` body and follows its instructions. For example:

- **Prompt**: "Create a logging middleware for my NextRush app"
- **Agent matches**: `nextrush-create-middleware` (description mentions "logging", "middleware", "NextRush")
- **Agent loads**: Full SKILL.md with code patterns, registers middleware correctly

### Explicit Invocation

In some agents, you can reference skills directly:

- **GitHub Copilot**: The skill appears in the skills list when relevant
- **OpenAI Codex**: `$nextrush-create-middleware` or `/skills` to browse
- **Claude Code**: Mention the skill by name in your prompt

---

## Cross-Platform Compatibility

NextRush skills are mirrored across all three standard locations:

```
.github/skills/nextrush-*/SKILL.md    → GitHub Copilot
.claude/skills/nextrush-*/SKILL.md    → Claude Code
.agents/skills/nextrush-*/SKILL.md    → OpenAI Codex
```

All three contain identical content. The canonical source is `.github/skills/`.

---

## Authoring New Skills

When creating a new NextRush skill:

1. Choose a name: `nextrush-<verb>-<noun>` (e.g., `nextrush-configure-cors`)
2. Create the directory in `.github/skills/nextrush-<name>/`
3. Write `SKILL.md` with proper frontmatter and body sections
4. Copy to `.claude/skills/` and `.agents/skills/`
5. Add MDX page in `apps/docs/content/skills/` for the docs site
6. Update `skills.json` by adding the skill metadata

### Description Checklist

- [ ] States WHAT the skill does (capabilities)
- [ ] States WHEN to use it (trigger scenarios)
- [ ] Includes KEYWORDS for discovery (API names, patterns)
- [ ] Under 1024 characters
- [ ] Does not use marketing language

### Body Checklist

- [ ] Under 500 lines
- [ ] Uses imperative mood ("Create...", "Register...", not "You can create...")
- [ ] Includes working, copy-paste code examples
- [ ] Shows correct imports from NextRush packages
- [ ] Documents constraints and rules
- [ ] References are relative paths from skill root

---

## References

- [Agent Skills Specification](https://agentskills.io/specification)
- [Vercel Skills Store](https://skills.sh)
- [GitHub Awesome Copilot Skills](https://github.com/github/awesome-copilot/blob/main/docs/README.skills.md)
- [OpenAI Codex Skills](https://developers.openai.com/codex/skills)
- [Example Skills by Anthropic](https://github.com/anthropics/skills)
