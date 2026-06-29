# Task: SP-349 — Stub contract enforcement

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Stub batch succeeded 14 M tasks with zero fileScopeMustChange diffs; SP-342 guard ineffective.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #40**: enforce `fileScopeMustChange` at lane commit — stub batch `20260629T021550` integrated .DONE-only with no src changes.

**Closes:** [#40](https://github.com/beettlle/pi-spine/issues/40)

## Dependencies

- **Task:** SP-342

## File Scope

- `src/batch/lane-commit.mjs`
- `src/batch/contract-verify.mjs`
- `src/config/spine-preflight-lib.mjs`
- `tests/batch/stub-contract-enforcement.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/stub-contract-enforcement.test.mjs` |
| fileScopeMustChange | `src/batch/lane-commit.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/stub-contract-enforcement.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #40 and batch 20260629T021550 journal

### Step 1: Implementation
- [ ] Fix per issue acceptance criteria

### Step 2: Testing & Verification
- [ ] Regression test
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Close issue #40
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #40 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Do NOT

- Close GitHub issue without verified fix on main

---
## Amendments (Added During Execution)
