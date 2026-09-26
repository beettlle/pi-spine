# Task: SP-771 — Type review-* engine-lanes modules (#283)

**Created:** 2026-09-26
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Review plan/code/final/poll paths are hot; typing may need careful JSDoc on mutated batch-state. Serialize after SP-770 to avoid allowlist/tsconfig merge conflicts.
**Score:** 5/8 — Blast radius: 3, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** #283 Phase 2 middle cluster — `review-plan`, `review-final`, `review-code`, `review-poll` still carry `@ts-nocheck` after SP-770 clears the small set.

## Mission

Partial #283 — Remove `@ts-nocheck` from `review-plan.mjs`, `review-final.mjs`, `review-code.mjs`, and `review-poll.mjs`. Expand `tsconfig.batch.json` include and shrink allowlist **only** for these four. Prefer `Record<string, any>` for mutated batch-state params (see `state-guards.mjs`). Do not type matrix/merge (SP-772).

## Dependencies

- **Task:** SP-770 (allowlist/tsconfig baseline after small-module typing)

## Context to Read First

- GitHub #283
- `spine-tasks/SP-770-type-engine-lanes-small/PROMPT.md` — prior slice
- `src/batch/state-guards.mjs` — `Record<string, any>` pattern
- Target review-* modules

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review-plan.mjs`
- `src/batch/engine-lanes/review-final.mjs`
- `src/batch/engine-lanes/review-code.mjs`
- `src/batch/engine-lanes/review-poll.mjs`
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && npx tsc --project tsconfig.batch.json --noEmit && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/review-plan.mjs`, `src/batch/engine-lanes/review-final.mjs`, `src/batch/engine-lanes/review-code.mjs`, `src/batch/engine-lanes/review-poll.mjs`, `tsconfig.batch.json`, `tests/arch/ts-nocheck-guard.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-770 `.DONE` and small modules no longer on allowlist
- [ ] Confirm four review-* targets still have `@ts-nocheck`
- [ ] Dependencies satisfied

### Step 1: Type review-* engine-lanes

- [ ] Remove `@ts-nocheck`; add compact JSDoc / casts
- [ ] Expand `tsconfig.batch.json` include for the four modules
- [ ] Shrink allowlist for the four modules only
- [ ] Stay under LOC policy; do not grow grandfather list

**Artifacts:**
- Four `review-*.mjs` modules (modified)
- `tsconfig.batch.json` (modified)
- `tests/arch/ts-nocheck-guard.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- None (docs deferred to SP-773)

**Check If Affected:**

- None

## Completion Criteria

- [ ] Four review-* modules pass batch tsc without nocheck
- [ ] Allowlist shrunk for those four
- [ ] Contract green
- [ ] Partial #283

## Git Commit Convention

- `refactor(SP-771): type review-* engine-lanes modules (#283)`

## Do NOT

- Re-type SP-770 modules except conflict repair
- Type matrix.mjs / matrix-run.mjs / merge.mjs (SP-772)
- Type reconcile/doctor (#284)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
