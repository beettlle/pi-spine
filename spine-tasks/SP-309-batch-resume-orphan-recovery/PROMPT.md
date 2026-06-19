# Task: SP-309 — Batch resume orphan recovery

**Created:** 2026-06-19
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Batch reliability regression — `batch resume --attached --force` restarts worker but attached engine exits; diagnosis stays `worker_orphaned`.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #13**: batch `20260619T020951` — after SP-306 plan review `nested_spawn_blocked` ([#12](https://github.com/beettlle/pi-spine/issues/12)), manual `batch resume --attached --force` restarts the lane worker but the **attached batch engine exits** without advancing the journal. Diagnosis remains `worker_orphaned`; SP-307–SP-305 stay blocked.

**Required behavior:**
1. `batch resume --attached` (with `--force` when engine is dead) keeps the engine process alive until wave completion or explicit detach.
2. On engine PID death while `phase: running`, surface `engine_orphaned` with one-shot recovery or auto-resume detached engine.
3. After resume, worker progresses past `worker.rules_selected` (plan review skip or engine-owned review).
4. Add regression test: plan `review.failed` → worker orphan → resume → worker completes (or actionable failure).

**Closes:** [#13](https://github.com/beettlle/pi-spine/issues/13)

## Dependencies

- **Task:** SP-296

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `spine-tasks/SP-296-engine-orphan-resume-core/PROMPT.md`
- `src/batch/detached-start.mjs` — attached resume spawn path
- `src/batch/resume-multi.mjs`
- `src/batch/reconcile.mjs` — `worker_orphaned` diagnosis
- `src/batch/diagnosis.mjs` — recovery suggestions
- GitHub issue #13; journal `.spine/runtime/20260619T020951/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/detached-start.mjs`
- `src/batch/resume-multi.mjs`
- `src/batch/reconcile.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/` (resume orphan recovery regression)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/detached-start.mjs, tests/batch/ |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/resume-orphan-recovery.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Reconstruct SP-306 timeline from issue #13 journal (28-line pattern)
- [ ] Confirm attached engine exits after `worker.rules_selected` without journal advance
- [ ] Verify whether lane-2 worktree already has SP-306 commits that batch state never merged

### Step 1: Fix attached resume engine lifecycle

> **Plan-review checkpoint**

- [ ] Ensure `batch resume --attached` keeps engine alive until wave completes (no background detach on force resume)
- [ ] On dead engine PID with `phase: running`, allow resume without prior pause (extend SP-296 path for `worker_orphaned`)
- [ ] After resume, worker should not stall at `worker.rules_selected` when engine is healthy

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Add `tests/batch/resume-orphan-recovery.test.mjs` reproducing batch `20260619T020951` pattern
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook — worker_orphaned after resume, retry vs pause-then-resume guidance
- [ ] Close GitHub issue #13: `gh issue close 13 --comment "Fixed in SP-309: attached resume keeps engine alive; worker_orphaned recovery after plan review failure."`
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Attached resume keeps engine alive through worker progress
- [ ] Regression test from issue #13 journal pattern
- [ ] Issue #13 closed
- [ ] `.DONE` created

## Git Commit Convention

- `fix(SP-309): description`
- `test(SP-309): description`

## Do NOT

- Revert SP-296 engine orphan resume behavior
- Remove SP-195 nested reviewer guard
