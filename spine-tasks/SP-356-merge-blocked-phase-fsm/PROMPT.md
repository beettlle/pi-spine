# Task: SP-356 — Merge blocked phase FSM

**Created:** 2026-06-28
**Size:** S
**Split from:** SP-347

## Review Level: 2 (Plan + Code)

**Assessment:** Terminal merge_blocked phase and clear stale enginePid after merge failure.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Part of **GitHub issue #38** (split from SP-347): when merge fails and engine exits, set terminal phase `merge_blocked`, clear `enginePid`, emit `batch.merge_blocked` journal event.

**Required behavior:**

1. Phase `merge_blocked` (not `merging`) when engine exits after merge failure.
2. Clear stale `enginePid` in batch state.
3. Regression test from batch 20260628T062636 pattern.

**Issue:** [#38](https://github.com/beettlle/pi-spine/issues/38) — delivery shared with split sibling

## Dependencies

- **Task:** SP-338

## File Scope

- `src/batch/lifecycle.mjs`
- `src/batch/engine-lanes/merge.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/merge-blocked-phase.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/merge-blocked-phase.test.mjs` |
| fileScopeMustChange | `src/batch/lifecycle.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/merge-blocked-phase.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #38 and superseded SP-347 PROMPT

### Step 1: Implementation
- [ ] Implement required behavior

### Step 2: Testing & Verification
- [ ] Contract test passes
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Required behavior implemented
- [ ] Tests pass with coverage gate


## Do NOT

- Expand beyond split scope from SP-347

---
## Amendments (Added During Execution)
