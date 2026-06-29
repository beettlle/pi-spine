# Task: SP-351 — Doctor stale-worktrees check

**Created:** 2026-06-28
**Size:** S
**Split from:** SP-335

## Review Level: 1 (Plan Only)

**Assessment:** Preflight/doctor should warn on worktrees for non-active batches.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Part of **GitHub issue #26** (split from SP-335): add doctor/preflight `stale-worktrees` check listing `.worktrees/spine-*` dirs with no matching active batch.

**Required behavior:**

1. Doctor check warns when stale spine worktree dirs exist.
2. Runbook documents cleanup after complete/dismiss.
3. Regression test for stale-worktrees detection.

**Closes:** [#26](https://github.com/beettlle/pi-spine/issues/26) (with sibling split tasks)

## Dependencies

- **Task:** SP-350

## File Scope

- `src/doctor/run-doctor-checks.mjs`
- `tests/doctor/stale-worktrees.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/stale-worktrees.test.mjs` |
| fileScopeMustChange | `src/doctor/run-doctor-checks.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/doctor/stale-worktrees.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #26 and superseded SP-335 PROMPT

### Step 1: Implementation
- [ ] Implement required behavior

### Step 2: Testing & Verification
- [ ] Contract test passes
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Close issue #26
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Required behavior implemented
- [ ] Tests pass with coverage gate
- [ ] Issue #26 closed

## Do NOT

- Expand beyond split scope from SP-335

---
## Amendments (Added During Execution)
