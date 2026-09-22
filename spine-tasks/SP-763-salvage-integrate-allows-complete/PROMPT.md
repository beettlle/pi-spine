# Task: SP-763 — After salvage --integrate, allow batch complete

**Created:** 2026-09-21
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Lifecycle complete gating; must clear or reclassify failed-task blockers after successful salvage integrate without masking true failures.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** After `spine batch salvage --lane N --integrate` lands `.DONE` work on main, `spine batch complete` / `--detect-manual-merge` still refuse with `needs_retry` because pre-salvage failed-task bits remain.

## Mission

Closes #292 — When salvage `--integrate` successfully lands lane work onto main (task `.DONE` / doneOnMain), `spine batch complete` (and `--detect-manual-merge`) must not refuse solely because the task was previously classified failed / `needs_retry`. Prefer clearing or healing the failed-task gate for salvaged tasks so operators are not forced to `dismiss --force`. Keep refusing complete when other unresolved failures remain.

## Dependencies

- **Task:** SP-762 (post-DONE plan-review classification — same incident family)

## Context to Read First

- `src/batch/lifecycle.mjs` — `completeBatch`
- `src/batch/salvage-batch-integrate.mjs`
- `src/batch/reconcile-batch.mjs` — `hasFailedTasks`
- GitHub #292

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lifecycle.mjs`
- `src/batch/salvage-batch-integrate.mjs`
- `tests/batch/salvage-complete-after-integrate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/salvage-complete-after-integrate.test.mjs` |
| fileScopeMustChange | `tests/batch/salvage-complete-after-integrate.test.mjs` |

## Steps

### Step 0: Preflight

- [x] Confirm complete refuses after salvage integrate when failedTasks still set
- [x] Dependencies satisfied (SP-762)

### Step 1: Heal complete after salvage land

- [x] After successful salvage integrate for a task, complete no longer refuses solely on that task's prior failure bit
- [x] Still refuse when other unresolved failed tasks remain
- [x] Unit/integration test covering salvage→complete happy path

**Artifacts:**
- lifecycle/salvage modules as needed (modified)
- `tests/batch/salvage-complete-after-integrate.test.mjs` (new)

### Step 2: Testing & Verification

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand`
- [x] Fix all failures

### Step 3: Documentation & Delivery

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-766 owns docs)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — salvage land loop

## Completion Criteria

- [x] Salvage integrate → batch complete succeeds without dismiss --force
- [x] Unrelated failures still block complete
- [x] Closes #292

## Git Commit Convention

- `fix(SP-763): allow batch complete after salvage integrate (#292)`

## Do NOT

- Auto-dismiss batches
- Skip gate approve / integrate when orch still needs them
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
