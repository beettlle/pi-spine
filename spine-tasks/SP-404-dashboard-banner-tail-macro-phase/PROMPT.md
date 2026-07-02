# Task: SP-404 — Dashboard banner tail macro-phase

**Created:** 2026-07-01
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Dashboard banner badge/text during tail states without active workers.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #68 (Tier 1 UI)**: align dashboard banner with SP-403 tail-state diagnosis — show macro-phase-specific text or neutral "finalizing" badge when lanes have no Running/Queued tasks but batch is still open.

## Dependencies

- **Task:** SP-403 (tail-state diagnosis headline)

## Context to Read First

- GitHub issue #68
- `src/dashboard/view.mjs` (`buildBannerModel`)
- SP-403 diagnosis output

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/view.mjs`
- `tests/dashboard/ui-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `src/dashboard/view.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #68 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Read SP-403 headline/macroPhase fields exposed to dashboard snapshot

### Step 2: Banner model tail states

- [ ] Update `buildBannerModel` to use macro-phase label when no active lane tasks
- [ ] Use neutral/finalizing badge instead of green running when appropriate
- [ ] Keep green running badge when `hasRunningTasks`

### Step 3: UI contract tests

- [ ] Add snapshot fixture for tail state banner model
- [ ] Assert banner subline or badge reflects merge/gate activity

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

- `feat(SP-404): complete Step N — description`
- `fix(SP-404): description`
- `test(SP-404): description`

## Do NOT

- Duplicate reconcile logic in dashboard
- Change lane table columns (SP-406)

---

## Amendments (Added During Execution)
