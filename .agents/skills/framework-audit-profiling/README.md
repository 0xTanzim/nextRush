# Framework Audit and Profiling — Agent Skill

A reusable Agent Skills-format skill for cheap-model-first, evidence-driven codebase audits, profiling, and framework comparisons. It is tailored using the supplied NextRush `framework-profiling` workflow and the supplied 2026 architecture-modernization audit as case-study material.

## Package contents

- `SKILL.md` — required instructions and workflow.
- `references/nextrush-workflow.md` — repo-specific profiling commands and pitfalls derived from the supplied workflow. Re-check paths and versions before use.
- `references/comparison-method.md` — current-source research and fair benchmark comparison rules.
- `references/finding-schema.md` — severity, confidence, evidence and finding format.
- `references/cheap-model-runbook.md` — cost tiers, stage gates, context-budget rules and a reusable activation prompt.
- `templates/` — files scaffolded into a repository's `.audit/` folder.
- `scripts/init-audit.sh` — creates `.audit/` without overwriting existing files by default.
- `scripts/validate-audit.py` — verifies expected artifacts, manifest syntax and basic content completeness.

## Install/use

Copy the `framework-audit-profiling` directory into the skill directory supported by your agent. For Claude Code, project skills commonly live under `.claude/skills/` and personal skills under `~/.claude/skills/`; other clients may use a different location or a skills ZIP upload.

From the target repository root:

```bash
bash /path/to/framework-audit-profiling/scripts/init-audit.sh --root "$PWD"
```

Ask the agent to run the architecture/performance audit. The agent should first inspect `AGENTS.md`, git status, project instructions, RFCs and existing test/benchmark tools, then fill the generated `.audit/` files as it gathers evidence.

Validate the artifact structure with:

```bash
python3 /path/to/framework-audit-profiling/scripts/validate-audit.py --root "$PWD"
```

## Scope caveat

The current package uses the uploaded audit and profiling guide as method inputs. It does **not** assert that the audit's October 2026 metrics are current or re-verify all claims in the large report. The skill explicitly tells the agent to rerun measurements and verify contemporary competitor/runtime facts before repeating them.
