# Spec persistence models

**Audience:** Operators and task authors using pi-spine  
**Related:** [upstream-execution-workflow.md](./upstream-execution-workflow.md), [create-spine-tasks skill](../../skills/create-spine-tasks/SKILL.md), [operator-runbook.md](./operator-runbook.md)

pi-spine runs work from **task packets** (`PROMPT.md`, `STATUS.md`) under `{tasksRoot}/`. Requirements change during and after authoring. This page names three common **spec persistence models** — adapted from [spec-kit spec persistence](https://github.com/github/spec-kit/blob/main/docs/concepts/spec-persistence.md) — and maps each to pi-spine mechanics so teams choose a convention explicitly.

pi-spine does not enforce one model in code. The batch engine, validator, and replan path support all three when operators follow the habits below.

---

## Two separate questions

Spec-driven development asks how long specifications matter **and** what happens when requirements change.

**Lifecycle (from SDD practice):**

| Level | Meaning |
|-------|---------|
| **Spec-first** | Write a spec before coding; allow discard after ship |
| **Spec-anchored** | Keep the spec for future changes |
| **Spec-as-source** | Spec is the only human-edited source; regenerate derived artifacts |

**Mutation (this document):** When requirements change, do you create new task folders, edit the upstream PRD and regenerate packets, or reconcile in place across artifacts?

The models below answer the mutation question for pi-spine teams.

---

## Flow-forward spec (pi-spine default)

Use flow-forward when each task folder should remain a **historical record** of what was asked at launch time.

### Convention

- Completed or obsolete packets are **not rewritten in place** for new scope.
- When scope splits or a task is too large, create **new** `SP-*` folders and mark parents with a **`.SUPERSEDED`** file.
- Update `{tasksRoot}/CONTEXT.md` and `{tasksRoot}/dependencies.json` so planners and operators see lineage.

### pi-spine mechanics

| Mechanism | Role |
|-----------|------|
| **Task folders** | One folder per packet; `PROMPT.md` above `---` is canonical for that run |
| **`STATUS.md`** | Execution memory for that folder only; not copied forward automatically |
| **`.SUPERSEDED`** | Marker file in parent folder (e.g. `Superseded by SP-263, SP-264`) — excluded from `spine plan pending`; batch start rejects unless `--force-superseded` |
| **`CONTEXT.md`** | Phase tables document supersession (e.g. SP-257→263–264) |
| **`dependencies.json`** | Edges point new tasks at predecessors; old IDs stay for audit |

### Example (pi-spine dogfood)

Phase 28 split oversized tasks into S-sized children:

- `SP-257-stabilize-sat020-coverage/.SUPERSEDED` → `Superseded by SP-263, SP-264`
- `CONTEXT.md` lists **Superseded:** SP-257→263–264, SP-258→265–266, …

### When to use

- Auditability and traceability matter
- Parallel batches need **disjoint File Scope** per wave
- You want a clear sequence of requirement changes over time

### Watch out for

- Context spread across folders — link supersession in `CONTEXT.md` and dependency edges
- Stale IDs in operator notes — use `spine plan pending`, not memorized parent IDs

---

## Living spec

Use living spec when the **upstream PRD or feature spec** is the contract and task packets are **derived** from it.

### Convention

- Edit the PRD, `docs/` spec, or optional spec-kit `specs/<feature>/spec.md` **first**.
- Regenerate or refresh spine packets with **`create-spine-tasks`** (decompose PRD → new or updated `SP-*` folders).
- Treat existing `plan.md` / `tasks.md` (spec-kit) or prior `PROMPT.md` drafts as disposable unless you flow-forward them into new folders.

### pi-spine mechanics

| Mechanism | Role |
|-----------|------|
| **Upstream doc** | Source of truth listed in `## Context to Read First` |
| **`create-spine-tasks`** | Step A–C: read PRD, slice tasks, update `CONTEXT.md` + `dependencies.json` |
| **`spine tasks validate pending`** | Catch PROMPT errors before batch launch |
| **New task folders** | Often combined with flow-forward (new folders per regeneration wave) |

### When to use

- Product contract is stable enough to own the workflow
- Team is comfortable re-running decomposition after spec edits
- Consistency between requirements and packets matters more than preserving every intermediate PROMPT

### Watch out for

- In-flight batches — do not mutate packets workers are executing; land or pause, then regenerate
- Lost rationale — capture important implementation decisions in PRD, explore findings, or `CONTEXT.md`, not only in discarded PROMPT drafts

---

## Flow-back spec

Use flow-back when **any artifact** may lead a change and the team **reconciles manually**.

### Convention

- Edits can start in implementation, reviewer feedback, operator notes, or the packet itself.
- Reconcile by amending `PROMPT.md`, fixing scope after review, or adjusting `STATUS.md` checkboxes — without necessarily creating a new task ID.

### pi-spine mechanics

| Mechanism | Role |
|-----------|------|
| **`PROMPT.md` amendments** | Add scope corrections below `---` under `## Amendments (Added During Execution)` — for contradictions or operator-approved scope fixes, not silent creep |
| **`needs_replan` verdict** | Final review `REPLAN` → task `exitReason: needs_replan`; blocks wave merge until PROMPT is fixed |
| **`spine batch retry <id>`** | Reset failed/replan task after PROMPT edit; journal records retry |
| **`spine tasks validate <id>`** | Confirm packet still parses before retry |
| **`STATUS.md`** | Honest checkboxes and step status during reconcile |

### Replan flow (operator)

```bash
spine status --diagnose    # diagnosis: needs_replan
# Read .reviews/final-*.md
# Edit PROMPT.md (scope, steps, Contract, dependencies)
spine tasks validate SP-042
spine batch retry SP-042
spine batch resume
```

See [upstream-execution-workflow.md § Final verdict and replan](./upstream-execution-workflow.md#final-verdict-and-replan-v13) and [operator-runbook.md § Replan](./operator-runbook.md#replan-v13--fr-uxb-04).

### When to use

- Small team; drift is noticed quickly
- Implementation discoveries reshape scope mid-batch
- Speed matters more than immutable per-folder history

### Watch out for

- **Silent divergence** — if code and PROMPT disagree, future workers trust the packet
- Amendments are not a substitute for flow-forward when scope fundamentally changed — prefer new `SP-*` + `.SUPERSEDED` for large pivots

---

## Operator decision table

| Situation | Preferred model | pi-spine action |
|-----------|-----------------|-----------------|
| M/L task should split into S tasks | Flow-forward | New folders; `.SUPERSEDED` on parent; update `dependencies.json` |
| PRD section rewritten before batch | Living spec | Edit PRD → `create-spine-tasks` → `spine tasks validate pending` |
| Final review: wrong File Scope / steps | Flow-back | Edit `PROMPT.md` → `spine batch retry` (may show `needs_replan`) |
| Mid-implementation scope tweak (same deliverable) | Flow-back | `PROMPT.md` amendments below `---`; update `STATUS.md` |
| Epic pivot; old task misleading | Flow-forward | `.SUPERSEDED` + new tasks; do not `--force-superseded` unless deliberate rerun |
| spec-kit `tasks.md` out of date | Living spec | Update `spec.md` → reconvert via skill; new `SP-*` packets |
| Worker discovered missing prerequisite | Flow-back | Amend PROMPT or REPLAN → operator edit → retry |

---

## Choosing a model

The model is a **team convention**, not a `spine-config.json` setting. Different epics may use different models if contributors know which applies.

Answer these before the next batch:

1. Should completed task folders be **historical records** (flow-forward) or **editable work areas** (flow-back)?
2. Is the **PRD/spec** the single source of truth (living spec), or are **packets** co-equal after authoring (flow-back)?

Document the choice in project onboarding or `docs/constitution.md` (from `spine init`) so future authors align with `create-spine-tasks` decomposition.

---

## Quick reference

| Model | Mutation rule | pi-spine default? |
|-------|---------------|-------------------|
| **Flow-forward** | New task folder per change; `.SUPERSEDED` on obsolete parents | **Yes** — matches staged `SP-*` waves and audit trail |
| **Living spec** | Edit upstream PRD/spec; regenerate packets | Common with spec-kit Path 4 (optional upstream) |
| **Flow-back** | Reconcile via PROMPT amendments, `needs_replan`, `spine batch retry` | Supported; use for in-flight corrections |

---

## Further reading

- [upstream-execution-workflow.md](./upstream-execution-workflow.md) — authoring paths and replan
- [create-spine-tasks SKILL.md](../../skills/create-spine-tasks/SKILL.md) — PRD decomposition and amendments
- [operator-runbook.md](./operator-runbook.md) — `needs_replan`, retry, `.SUPERSEDED` guard
- [spec-kit spec persistence](https://github.com/github/spec-kit/blob/main/docs/concepts/spec-persistence.md) — upstream terminology source
