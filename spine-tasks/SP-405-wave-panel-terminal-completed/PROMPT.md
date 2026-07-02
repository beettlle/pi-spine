# Task: SP-405 — Wave panel terminal completed

**Created:** 2026-07-01
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Wave progress marks last wave completed when all its tasks are terminal.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #68 (Tier 2)**: in `buildWaveProgress`, mark a wave `completed` when all task IDs in `wavePlan[index]` are terminal-success in classified tasks — not only when `index < currentWaveIndex`.

## Dependencies

- **Task:** SP-379 (lane queue snapshot helpers land first — shared `src/dashboard/snapshot.mjs`)

## Context to Read First

- GitHub issue #68
- `src/dashboard/snapshot.mjs` (`buildWaveProgress`)
- `tests/dashboard/snapshot.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `tests/dashboard/snapshot.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/snapshot.test.mjs` |
| fileScopeMustChange | `src/dashboard/snapshot.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #68 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Reproduce: last wave `active` while all tasks succeeded

### Step 2: buildWaveProgress terminal check

- [ ] Accept classified task map or derive terminal status per wave task ID
- [ ] Set wave status `completed` when every task in wave is terminal-success
- [ ] Keep `active` only when wave has non-terminal tasks or is current with in-flight work

### Step 3: Snapshot tests

- [ ] Add test: currentWaveIndex at last wave, all tasks succeeded → wave status completed
- [ ] Ensure true in-flight wave still shows active

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Acceptance criteria met

## Git Commit Convention

- `feat(SP-405): complete Step N — description`
- `fix(SP-405): description`
- `test(SP-405): description`

## Do NOT

- Change diagnosis headline (SP-403)
- Modify batch-state schema

---

## Amendments (Added During Execution)
