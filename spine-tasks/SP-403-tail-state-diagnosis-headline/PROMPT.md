# Task: SP-403 — Tail-state diagnosis headline

**Created:** 2026-07-01
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Diagnosis headline when batch running with zero active workers.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #68 (Tier 1)**: when `phase === "running"` but no tasks are `running` or `pending`, `deriveDiagnosis` must not emit generic `{batchLabel} is running`. Derive headline from `macroPhase` / journal tail (e.g. merging, opening integrate gate, finalizing land loop).

## Dependencies

- **None**

## Context to Read First

- GitHub issue #68
- `src/batch/diagnosis.mjs`
- `src/batch/macro-phase.mjs`
- `.spine/runtime/20260701T031142/archive/batch-state.json` (fixture reference)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/macro-phase.mjs`
- `tests/batch/diagnosis.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/diagnosis.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #68 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Re-read issue #68 Tier 1 acceptance
- [ ] Simulate tail state: all tasks terminal, phase running

### Step 2: Implement tail-state headline

- [ ] When `hasRunningTasks` and `hasPendingTasks` are false but batch not terminal, derive headline from macroPhase
- [ ] Map `needs_merge`, integrate/gate limbo, land-loop milestones to operator-readable strings
- [ ] Preserve generic running headline when workers are active

### Step 3: Diagnosis tests

- [ ] Add fixture-based test using archived batch-state shape
- [ ] Assert headline is not bare "is running" without activity hint

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] Review `docs/adoption/operator-runbook.md` if affected

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Acceptance criteria met

## Git Commit Convention

- `feat(SP-403): complete Step N — description`
- `fix(SP-403): description`
- `test(SP-403): description`

## Do NOT

- Change wave panel or dashboard banner (SP-404/405)
- Alter engine merge/gate behavior

---

## Amendments (Added During Execution)
