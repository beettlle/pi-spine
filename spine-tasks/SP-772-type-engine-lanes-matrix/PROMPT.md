# Task: SP-772 — Type matrix/merge engine-lanes modules (close #283)

**Created:** 2026-09-26
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** `matrix.mjs`, `matrix-run.mjs`, and `merge.mjs` are the largest engine-lanes modules; typing under LOC cap needs cast-heavy JSDoc. Completing this cluster closes #283.
**Score:** 6/8 — Blast radius: 4, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** #283 remaining nocheck debt in matrix/merge after SP-770/SP-771. These files are near/over 500 LOC — type in place without growing `PHASE23_GRANDFATHERED_OVER_500`.

## Mission

Closes #283 — Remove `@ts-nocheck` from `matrix.mjs`, `matrix-run.mjs`, and `merge.mjs`. Expand `tsconfig.batch.json` include and shrink allowlist for these three (and any leftover engine-lanes allowlist entries that this issue owns). After this task, **no** `src/batch/engine-lanes/**` path (including `src/batch/engine-lanes.mjs`) should remain on `NOCHECK_ALLOWLIST`. Prefer compact casts; do not split files in this task.

## Dependencies

- **Task:** SP-771 (review-* typing + allowlist/tsconfig baseline)

## Context to Read First

- GitHub #283 — acceptance criteria
- `spine-tasks/SP-770-type-engine-lanes-small/PROMPT.md`
- `spine-tasks/SP-771-type-engine-lanes-review/PROMPT.md`
- Target matrix/merge modules + LOC policy notes from #283

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/matrix.mjs`
- `src/batch/engine-lanes/matrix-run.mjs`
- `src/batch/engine-lanes/merge.mjs`
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && npx tsc --project tsconfig.batch.json --noEmit && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/matrix.mjs`, `src/batch/engine-lanes/matrix-run.mjs`, `src/batch/engine-lanes/merge.mjs`, `tsconfig.batch.json`, `tests/arch/ts-nocheck-guard.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-771 `.DONE`; review-* off allowlist
- [ ] Confirm matrix/merge/matrix-run still have `@ts-nocheck`
- [ ] Note LOC vs `BATCH_MODULE_LOC_LIMIT` for each target
- [ ] Dependencies satisfied

### Step 1: Type matrix/merge engine-lanes

- [ ] Remove `@ts-nocheck`; add compact JSDoc / casts
- [ ] Expand `tsconfig.batch.json` include for the three modules
- [ ] Shrink allowlist so **zero** `engine-lanes` paths remain
- [ ] Do not grow `PHASE23_GRANDFATHERED_OVER_500`

**Artifacts:**
- Three matrix/merge modules (modified)
- `tsconfig.batch.json` (modified)
- `tests/arch/ts-nocheck-guard.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Spot-check: `rg '@ts-nocheck' src/batch/engine-lanes src/batch/engine-lanes.mjs` → empty
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md (docs deferred to SP-773)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- None (docs deferred to SP-773)

**Check If Affected:**

- None

## Completion Criteria

- [ ] matrix / matrix-run / merge pass batch tsc without nocheck
- [ ] No engine-lanes paths remain on NOCHECK_ALLOWLIST
- [ ] Contract green
- [ ] Closes #283

## Git Commit Convention

- `refactor(SP-772): type matrix/merge engine-lanes modules (#283)`

## Do NOT

- Type reconcile/doctor clusters (#284)
- Split/move large modules in this task (typing only)
- Grow grandfather LOC list to dodge the policy
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
