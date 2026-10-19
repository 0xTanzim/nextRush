# systems-performance-engineering

A reusable Agent Skill for evidence-driven systems reasoning and performance engineering in NextRush and TypeScript multi-runtime systems.

## Contents

- `SKILL.md`: activation triggers, mandatory workflow, decision rules and definition of done.
- `references/`: on-demand technical guides for cost models, CPU/caches, memory/GC, JavaScript engines, operating systems, networking/I/O, NextRush request paths, profiling, and optimization traps.
- `templates/investigation-record.md`: a reproducible investigation record.
- `AGENTS-md-integration.md`: suggested compact section for the project's root instructions.

## Installation

Copy `systems-performance-engineering/` into the repository's existing skill location, adapting the directory to the coding agent's skill convention. Do not create a second competing skill directory if the repository already has one. Add or merge the snippet in `AGENTS-md-integration.md` into root `AGENTS.md`.

Agent Skills support and activation differ by tool. Verify that the target coding agent discovers `SKILL.md`, supports its frontmatter convention, and can read the reference files. Explicitly reference the skill from the root instructions for performance-sensitive work.

## Scope boundaries

This skill teaches reasoning and technical concepts. It does not replace repository-specific benchmark commands, the existing `framework-profiling` skill, or the `framework-audit-profiling` workflow. Read those when relevant. It does not assert that any listed bottleneck exists in the current implementation.
