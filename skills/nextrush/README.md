# NextRush Agent Skill

Gives AI coding agents accurate, up-to-date knowledge of the [NextRush](https://github.com/0xTanzim/nextRush) framework — APIs, adapters (Node/Bun/Deno/Edge/Serverless/Next.js), class DI, middleware, streaming, WebSocket, testing, and best practices.

## Install

```bash
npx skills add https://github.com/0xTanzim/nextRush --skill nextrush
```

(Adjust org/repo URL to match the published location.)

Works with Agent Skills–compatible clients (Claude Code, Copilot, Codex, OpenCode, etc.).

## Layout

```
nextrush/
├── AGENTS.md                # AUTO-LOADED standing orders (many hosts inject this)
├── SKILL.md                 # full skill body (progressive disclosure entry)
├── README.md                # this file — install / publish notes
└── references/              # deep dives loaded on demand
    ├── architecture.md
    ├── adapters.md
    ├── serverless-edge.md
    ├── nextjs.md
    ├── functional-api.md
    ├── class-api.md
    ├── context.md
    ├── middleware.md
    ├── errors.md
    ├── streaming.md
    ├── websocket-events.md
    ├── testing.md
    ├── scaffolding.md
    └── best-practices.md
```

### How agents load this

1. **`AGENTS.md`** — hosts that auto-discover `AGENTS.md` inject it into context when the skill
   folder is present (install path or monorepo). Short standing orders + golden paths.
2. **`SKILL.md`** — Agent Skills protocol entry (`name` + `description` frontmatter). Loaded when
   the skill triggers. Points into `references/`.
3. **`references/*`** — on-demand only.

Keep all three layers together after install. Do not strip `AGENTS.md` or `references/`.

## Why this exists

NextRush is newer than most model training cutoffs. Without this skill, agents invent Express/Fastify/Nest patterns that do not match NextRush. With it, agents use real package names, real Context methods, and the correct adapter for each host.

## License

MIT
