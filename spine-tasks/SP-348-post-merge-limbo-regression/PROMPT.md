# Task: SP-348 — Post-merge limbo regression fix

**Created:** 2026-06-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** SP-316 regression — attached engine SIGTERM orphan after last merge; gate not opened without manual finalize.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #39**: batch `20260629T021550` — post-merge limbo recurrence; `resume --attached` hung; detached `resume --force` did not auto-open gate.

**Closes:** [#39](https://github.com/beettlle/pi-spine/issues/39)

## Dependencies

- **Task:** SP-316

## File Scope

- `src/batch/post-merge-limbo.mjs`
- `src/batch/resume.mjs`
- `src/batch/attached-runner.mjs`
- `tests/batch/post-merge-limbo-regression.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/post-merge-limbo-regression.test.mjs` |
| fileScopeMustChange | `src/batch/post-merge-limbo.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/post-merge-limbo-regression.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #39 and batch 20260629T021550 journal

### Step 1: Implementation
- [ ] Fix per issue acceptance criteria

### Step 2: Testing & Verification
- [ ] Regression test
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Close issue #39
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #39 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Do NOT

- Close GitHub issue without verified fix on main

---
## Amendments (Added During Execution)
