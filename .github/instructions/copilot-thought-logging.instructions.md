---
applyTo: '**'
description: 'Session-isolated, multi-agent safe Copilot orchestration with deterministic lifecycle, recovery, and controlled aggregation.'
---

# Copilot Process Orchestration Specification

---

## Global Operating Principles

* Read this specification fully before execution.
* Execute one stage at a time.
* Do not combine stages.
* Do not skip stages.
* Do not emit explanations unless explicitly required.
* Only output what the current stage explicitly requires.
* If rules conflict, prioritize session isolation and data safety.

---

# Session Model

## Session Continuity Rule

* One chat session MUST map to one session file.
* If a session file already exists for the current chat:

  * Reuse it.
  * Do NOT generate a new session ID.
* Only generate a new session file when no session file exists for the current chat.

---

## Session Isolation Rules

* All tracking files MUST exist under:

```
/copilot-process/
```

* Each session file MUST use a unique identifier:

```
<timestamp>-<short-random-id>.md
```

Example:

```
/copilot-process/2026-03-03T17-42-11-a8f3.md
```

* Never overwrite an existing session file.
* Never modify a file created by another session.
* Never use fixed filenames.

---

# Required File Structure

Each session file MUST contain:

```
# Session Metadata
Spec Version:
Session ID:
Parent Session:
Agent Role:
Start Time:
Status:

# User Request

# Action Plan

# Execution Log

# Summary
```

---

## Status Lifecycle

Allowed values:

* INITIALIZED
* PLANNING
* EXECUTING
* COMPLETED
* FAILED
* MERGED
* ARCHIVED
* ORPHANED

Rules:

* Only parent sessions may reach COMPLETED.
* Sub-agents reach COMPLETED, then become MERGED after aggregation.
* ARCHIVED is optional manual state.
* ORPHANED is used if parent never merges sub-agent output.

---

# Stage 1 — Initialization

* If session file exists for this chat:

  * Resume it.
  * Do not create a new file.
* Otherwise:

  * Create `/copilot-process/` if missing.
  * Generate unique session ID.
  * Create new session file.
  * Populate:

    * Metadata
    * User Request
    * Status = INITIALIZED.
* Stop after completion.

---

# Stage 2 — Planning

* Update Status = PLANNING.
* Populate Action Plan section.
* Tasks must:

  * Be atomic.
  * Be independently executable.
  * Include dependencies if needed.
  * Use checkbox format:

```
- [ ] Task description
```

* Do not emit commentary.
* Stop after completion.

---

# Stage 3 — Execution

* Update Status = EXECUTING.
* Execute tasks sequentially unless explicitly delegated to sub-agents.
* After completing each task:

```
- [x] Task description
```

* Log meaningful execution steps under Execution Log.

### Failure Handling

If failure occurs:

* Update Status = FAILED.
* Log error clearly.
* Stop immediately.

### Recovery Rule

If session file exists and:

* Status != COMPLETED
* There are incomplete tasks

Resume from first unchecked task.

Do not restart entire process.

---

# Stage 4 — Summary

* Populate Summary section with:

  * Work completed
  * Final state
  * Unresolved items
* Update Status = COMPLETED.
* Output exactly:

```
Added final summary to the session file.
Please review the summary and confirm completion.
Remove or archive the session file if it should not be committed.
```

* Stop execution.

---

# Multi-Agent Orchestration Rules

## Sub-Agent Creation

* Sub-agents MUST create independent session files.
* File naming pattern:

```
<parent-session-id>-sub-<role>-<index>.md
```

Example:

```
2026-03-03T17-42-a8f3-sub-auth-01.md
```

* Parent Session field MUST reference parent session ID.
* Sub-agents MUST NOT modify parent file directly.

---

## Sub-Agent Lifecycle

* Sub-agent completes work.
* Sub-agent sets Status = COMPLETED.
* Parent reads sub-agent Summary.
* Parent copies relevant outputs into its Execution Log.
* Parent updates sub-agent Status = MERGED.
* Sub-agent file is retained unless manually archived.

---

## Sub-Agent Restrictions

* Sub-agents MAY NOT spawn additional sub-agents unless explicitly authorized by parent session.
* Sub-agents MUST NOT modify other sub-agent files.
* Sub-agents MUST NOT modify code files in parallel without parent coordination.

---

# Orchestration Safety Rules

* Parent session controls merge order.
* Parent must verify sub-agent completion before merging.
* If parent fails before merging:

  * Sub-agent files remain.
  * Parent may resume and merge.
* If sub-agent is never merged:

  * Mark Status = ORPHANED.

---

# Concurrency Rules

* Never assume exclusive access to workspace.
* Never rely on file overwrite.
* Never use shared mutable tracking files.
* Never auto-delete sub-agent files.

---

# Cleanup Policy

* `/copilot-process/` SHOULD be added to `.gitignore`.
* Parent session files remain until confirmed complete.
* Sub-agent files should be:

  * Marked MERGED before archival.
  * Archived manually if no longer needed.
* No automatic deletion without explicit instruction.
