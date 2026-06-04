# Task: SP-095 — Orphan detection scoped to current engine session

**Created:** 2026-06-04
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** searchATon batch `20260603T224829` stayed `diagnosis: running` with a dead engine because `journalHasTerminalBatchEvent` matched *historical* `task.failed` / `lane.died` from before `batch.resumed`, suppressing `engine_orphaned` (SP-082 gap).
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Close the **SP-082 false negative** when a batch resumes after prior failures: orphan engine detection must consider only journal events from the **current detached engine session** (after the latest `batch.resumed` or `resilience.engineStartedAt`), not the full journal file.

When `phase: running`, `resilience.enginePid` is dead, and there is no terminal event in the **scoped** window, reconcile must return `engine_orphaned` (or `needs_retry` when a dead lane `workerPid` is the clearer signal) — never plain `running`.

**Bug report:** `/Users/cdelgado/Documents/github.com/searchATon/spine-bug-report-batch-20260603T224829.md` (Bug 1).

## Dependencies

- **None**

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md` — Phase 14 (SP-082) and Phase 17

**Tier 3:**
- `src/batch/orphan-detect.mjs`
- `src/batch/reconcile.mjs`
- `src/batch/state.mjs`
- `docs/incidents/20260603-orphan-running-resume.md`
- `tests/batch/orphan-reconcile.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/orphan-detect.mjs`
- `src/batch/reconcile.mjs`
- `tests/batch/orphan-reconcile.test.mjs`
- `tests/batch/orphan-detect-scope.test.mjs` (new)
- `tests/fixtures/incidents/resume-orphan-historical-failure.json` (new)

## Steps

### Step 0: Preflight

- [ ] Confirm `detectOrphanRunning` uses whole-journal `journalHasTerminalBatchEvent`
- [ ] Add failing unit test: old `task.failed` + post-`batch.resumed` silence + dead `enginePid`

### Step 1: Scoped terminal-event window

> **Plan-review checkpoint**

- [ ] Add `journalEventsSinceResume` (or equivalent) anchored on latest `batch.resumed` / `engineStartedAt`
- [ ] Engine orphan branch uses scoped window only
- [ ] Call `spine_review_step` (plan)

### Step 2: Reconcile wiring

> **Code review checkpoint**

- [ ] Pass scoped events into `detectOrphanRunning`
- [ ] Dead engine after resume with historical failures → `engine_orphaned`, not `running`
- [ ] Call `spine_review_step` (code)

### Step 3: Testing & Verification

- [ ] Historical `task.failed` + dead engine → diagnosis ≠ `running`
- [ ] Terminal event within scoped window still suppresses false orphan
- [ ] SP-082 fixture regression passes
- [ ] FULL suite: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test`
- [ ] Coverage: `npm run coverage:check` — **≥77%**

### Step 4: Documentation & Delivery

- [ ] Update `docs/incidents/20260603-orphan-running-resume.md` with batch `20260603T224829` note
- [ ] Log discoveries in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/incidents/20260603-orphan-running-resume.md`

**Check If Affected:**
- `docs/adoption/operator-runbook.md`
- `docs/PRD.md` (FR-BATCH-12/13 only if needed)

## Completion Criteria

- [ ] Dead engine after forced resume diagnosed even when older journal has `task.failed`
- [ ] SP-082 first-resume fixture still passes

## Git Commit Convention

- `feat(SP-095): complete Step N — description`

## Do NOT

- Change resume scheduling (SP-096)
- Auto-mutate batch-state on diagnose

---

## Amendments (Added During Execution)
