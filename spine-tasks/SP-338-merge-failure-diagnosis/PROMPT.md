# Task: SP-338 — Merge failure diagnosis

**Created:** 2026-06-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Wave merge failures report `phase: failed` with `failedTasks: 0` — headline misleading for operators and monitors.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #29**: when batch fails on wave merge (not task failure), diagnosis shows "0 failed task(s)" despite `mergeResults` recording failed lane.

**Required behavior:**

1. Surface `failedWaveIndex`, `failedLane`, and `lastError` in `spine status --diagnose` headline.
2. Add `mergeFailed` / `failedMerges` signal distinct from `failedTasks`.
3. Regression test with merge conflict fixture.

**Closes:** [#29](https://github.com/beettlle/pi-spine/issues/29)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #29
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/diagnosis.mjs`
- `bin/spine-status.mjs`
- `tests/batch/merge-failure-diagnosis.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/merge-failure-diagnosis.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/merge-failure-diagnosis.test.mjs` |

## Steps

### Step 0: Preflight: batch 20260625T025547 pattern

- [ ] Preflight: batch 20260625T025547 pattern

### Step 1: Diagnosis merge failure taxonomy

- [ ] Diagnosis merge failure taxonomy

### Step 2: Status JSON fields

- [ ] Status JSON fields

### Step 3: Tests + delivery

- [ ] Tests + delivery

### Step 4: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 5: Documentation & Delivery

- [ ] Close issue #29 (`gh issue close 29`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #29 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-338): complete Step N — description`
- `fix(SP-338): description`
- `test(SP-338): description`

## Do NOT

- Expand scope beyond issue #29 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
