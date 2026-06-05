# Task: SP-105 — Launch failure diagnosis surfacing

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** When an entire wave fails at worker launch (missing `PI_SPINE_ROOT`, broken worktree git), `spine status --diagnose` returns generic `needs_retry` without citing launch output — operators cannot distinguish infra misconfig from task failure.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Improve reconciliation and diagnosis when tasks fail **before** worker reaches `pi` phase:

1. Extract launch-failure hints from journal (`task.failed` with `classification`, `workerPhase: launching`, `output` tail, `workerOutputLogRef`)
2. Add diagnosis sub-reason or headline suffix for **worker_launch_failed** / **worktree_unhealthy** patterns
3. Surface `suggestedCommand` pointing at config fix (`spine doctor`, `PI_SPINE_ROOT`, worktree repair) vs blind `spine batch retry`
4. Publish incident doc for searchATon batch `20260605T160800` + regression fixture

## Dependencies

- **Task:** SP-104 (lane commit / worktree errors stabilized — diagnosis builds on hardened failure classes)

## Context to Read First

**Tier 3:**
- `src/batch/diagnosis.mjs` — taxonomy, `buildHeadline`, `buildSuggestedCommand`
- `src/batch/reconcile.mjs` — `buildDiagnosisOutput`, journal hint extraction
- `src/batch/journal.mjs` — `readLastTaskFailedEvent`, `extractJournalDiagnosisHints`
- `src/batch/engine-scope.mjs` — wave failure aggregation
- `docs/incidents/20260604-resume-parallel-lane-orphan.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/reconcile.mjs`
- `src/batch/engine-scope.mjs`
- `src/batch/journal.mjs`
- `tests/batch/launch-failure-diagnosis.test.mjs` (new)
- `tests/fixtures/incidents/lane-worktree-devcontainer.json` (new)
- `docs/incidents/20260605-lane-worktree-devcontainer.md` (new)

## Steps

### Step 0: Preflight

- [ ] Reproduce: batch with all tasks `task.failed` at launch → diagnose headline lacks launch context
- [ ] Inventory existing `extractJournalDiagnosisHints` fields

### Step 1: Journal hints + failure classification

> **Plan-review checkpoint**

- [ ] Extend journal hint extraction for launch failures: `workerPhase`, `exitReason`, log ref, first stderr line
- [ ] Map patterns: missing `PI_SPINE_ROOT`, worktree git error, hook failure → `launchFailureKind`
- [ ] Call `spine_review_step` (plan)

### Step 2: Diagnosis + reconcile surfacing

> **Code review checkpoint**

- [ ] `buildHeadline` / `buildSuggestedCommand` include launch-failure kind when ≥1 failed task failed at launch
- [ ] Wave-level aggregation in `engine-scope.mjs` if multiple lanes share same launch error
- [ ] `spine status --diagnose` shows actionable message (not plain `needs_retry`)
- [ ] Call `spine_review_step` (code)

### Step 3: Testing & Verification

- [ ] Fixture: all-launch-failure batch → diagnosis mentions launch kind + suggested fix
- [ ] Existing reconcile tests still pass
- [ ] FULL suite: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test`
- [ ] Coverage gate: `npm run coverage:check` — **≥77%**

### Step 4: Documentation & Delivery

- [ ] Incident doc `docs/incidents/20260605-lane-worktree-devcontainer.md` with timeline + fix table (SP-101–105)
- [ ] Operator runbook troubleshooting row for launch failures
- [ ] STATUS.md discoveries

## Documentation Requirements

**Must Update:**
- `docs/incidents/20260605-lane-worktree-devcontainer.md` (new)
- `docs/adoption/operator-runbook.md` — diagnose launch failure wave

**Check If Affected:**
- `docs/incidents/20260604-resume-parallel-lane-orphan.md` — cross-link

## Completion Criteria

- [ ] All-launch-failure batch diagnose cites root cause category
- [ ] Suggested command distinguishes config/worktree fix from task retry
- [ ] Incident fixture + doc published

## Git Commit Convention

- `feat(SP-105): launch failure diagnosis hints`
- `test(SP-105): launch failure diagnose regression`
- `docs(SP-105): lane worktree devcontainer incident`

## Do NOT

- Re-implement SP-101/102/103 fixes — only surface their failure modes
- Change worker spawn logic (SP-103)

---

## Amendments (Added During Execution)
