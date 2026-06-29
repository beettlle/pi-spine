# Task: SP-349 — Stub contract enforcement

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Stub batch succeeded 14 tasks with zero `fileScopeMustChange` diffs; supersedes SP-342 stub release guard.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issues #33 and #40**: enforce `fileScopeMustChange` at lane commit so stub workers cannot mark implementation tasks succeeded without in-scope diffs.

**Required behavior:**

1. Reject or fail stub completion when `fileScopeMustChange` paths have no diff at lane commit.
2. Surface `exitReason: stub` in diagnosis when `.DONE` contains `Task: stub` for M/L implementation tasks.
3. Preflight warn when `SPINE_WORKER_STUB=1` and pending tasks have release-critical contracts.
4. Regression test: stub cannot succeed merge/version task without file-scope changes.

**Closes:** [#33](https://github.com/beettlle/pi-spine/issues/33), [#40](https://github.com/beettlle/pi-spine/issues/40)

**Supersedes:** SP-342 (stub release task guard)

## Dependencies

- **None**

## File Scope

- `src/batch/lane-commit.mjs`
- `src/batch/contract-verify.mjs`
- `src/batch/diagnosis.mjs`
- `src/config/spine-preflight-lib.mjs`
- `tests/batch/stub-contract-enforcement.test.mjs`
- `tests/batch/stub-release-task-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/stub-contract-enforcement.test.mjs tests/batch/stub-release-task-guard.test.mjs` |
| fileScopeMustChange | `src/batch/lane-commit.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/stub-contract-enforcement.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issues #33, #40 and batch 20260629T021550 journal
- [ ] Read superseded SP-342 PROMPT for release-critical patterns

### Step 1: Lane commit contract enforcement
- [ ] Fail closed when stub completes without `fileScopeMustChange` diffs

### Step 2: Preflight warning + diagnosis
- [ ] Preflight warn on stub + release-critical pending tasks
- [ ] Diagnosis surfaces `exitReason: stub` when applicable

### Step 3: Testing & Verification
- [ ] Regression tests (contract + release guard)
- [ ] FULL suite + coverage gate

### Step 4: Delivery
- [ ] Close issues #33 and #40
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Stub cannot bypass `fileScopeMustChange` at lane commit
- [ ] Tests pass with coverage gate
- [ ] Issues #33 and #40 closed

## Do NOT

- Close GitHub issues without verified fix on main

---
## Amendments (Added During Execution)
