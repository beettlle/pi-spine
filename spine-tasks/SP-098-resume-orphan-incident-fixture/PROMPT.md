# Task: SP-098 — Resume orphan incident fixture (batch 20260603T224829)

**Created:** 2026-06-04
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Document and regression-test the searchATon consumer incident that exposed SP-082 gaps after forced multi-task resume — fixture-only, no engine changes.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Add incident fixture + tests for batch **`20260603T224829`** pattern: prior `task.failed` in journal, `batch.resumed` with five lane-1 tasks, parallel `task.started`, engine died in `commitLaneWorktree`, post-resume journal silence, dead `enginePid`, multiple `running` on one lane.

Complements SP-085 style; asserts reconcile diagnosis is actionable after SP-095/097 land.

**Bug report:** `/Users/cdelgado/Documents/github.com/searchATon/spine-bug-report-batch-20260603T224829.md`

## Dependencies

- **Task:** SP-095 (scoped orphan detect)
- **Task:** SP-097 (engine crash terminal phase)

## Context to Read First

**Tier 3:**
- `tests/fixtures/incidents/orphan-running-resume.json` (SP-085 pattern)
- `tests/batch/orphan-reconcile.test.mjs`
- `docs/incidents/20260603-orphan-running-resume.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/fixtures/incidents/resume-parallel-lane-orphan.json` (new)
- `tests/batch/orphan-reconcile.test.mjs`
- `docs/incidents/20260604-resume-parallel-lane-orphan.md` (new)

## Steps

### Step 1: Fixture + tests

- [ ] JSON fixture: batch-state + journal tail from bug report (redact PIDs to sentinel dead PID)
- [ ] Test: reconcile diagnosis ≠ `running`; expects `engine_orphaned` or `needs_retry` with `suggestedCommand`
- [ ] Test: fixture documents multiple `running` on lane 1 (state snapshot assertion optional)

### Step 2: Incident narrative

- [ ] New incident doc: timeline, root causes (4 bugs), link to SP-095–097, reproduction sketch
- [ ] Cross-link from `docs/incidents/20260603-orphan-running-resume.md`

### Step 3: Testing & Verification

- [ ] Run targeted tests: `SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test -- tests/batch/orphan-reconcile.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on changed paths

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/incidents/20260604-resume-parallel-lane-orphan.md` (new)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — orphan running troubleshooting link

## Completion Criteria

- [ ] Fixture replay fails on pre-fix spine, passes after SP-095 + SP-097

## Git Commit Convention

- `test(SP-098): resume parallel lane orphan fixture`

## Do NOT

- Implement fixes (SP-095–097 own implementation)

---

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-04

**Issue:** Batch `20260604T233856` failed at start with `prompt_parse_failed` — Step 3 was titled "Verification" (no "Testing" in title per SP-075 / `validatePrompt`).

**Resolution:** Renamed Step 3 to "Testing & Verification"; added Step 4 documentation delivery per prompt template.
