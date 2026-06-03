# Task: SP-058 — Salvage inspection on stall (FR-STALL-03A)

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

On `stall_timeout` or failed task without `.DONE`, operators need to know if **valid uncommitted work** exists in the lane worktree (SAT-020, I-01). Implement **FR-STALL-03A** read-only salvage: scoped porcelain + diff stat, journal `lane.salvage_inspection`, `task.failed` salvage fields, diagnose retry hints, `evidence/salvage-<taskId>.json`.

## Dependencies

- **SP-056**

## Context to Read First

**Tier 3:** `docs/features/stall-recovery-improvements-brief.md` (Feature 3 Phase A), `src/batch/worker-host.mjs`, `src/batch/engine.mjs`

## File Scope

- `src/batch/salvage.mjs` (new)
- `src/batch/worker-host.mjs`, `src/batch/engine.mjs`
- `src/batch/journal.mjs`, evidence collector
- `src/batch/reconcile.mjs` or status diagnose
- `tests/batch/salvage-inspect.test.mjs` (new)

## Steps

### Step 1: Salvage module

> **Plan-review checkpoint**

- [ ] `inspectLaneSalvage({ worktreePath, fileScopePaths, taskFolder })` → dirtyPaths, diffStat, recommendedAction
- [ ] Scope: File Scope + task folder paths only (document choice in code comment)

### Step 2: Wire stall/fail paths

- [ ] Run after `lane.stall_killed` / terminal fail without `.DONE`
- [ ] Journal `lane.salvage_inspection`; enrich `task.failed` with `salvageable`, `changedFileCount`

### Step 3: Diagnose + evidence

- [ ] `needs_retry` diagnosis: “N uncommitted files in scope” + `spine batch retry <id>`
- [ ] `evidence/salvage-<taskId>.json` in gate/archive bundle

### Step 4: Tests

> **Code review checkpoint**

- [ ] Stub stall with dirty scoped file → salvage event + counts
- [ ] No auto-commit, no `.DONE`, no merge changes

## Do NOT

- `autoCommitOnStall` (SP-059); auto-merge; force integrate

## Git Commit Convention

`feat(SP-058): salvage inspection on stall`

## Amendments

_(Workers only.)_
