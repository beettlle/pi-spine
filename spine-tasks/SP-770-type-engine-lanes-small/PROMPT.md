# Task: SP-770 — Type small engine-lanes modules + facade (#283)

**Created:** 2026-09-26
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Removing `@ts-nocheck` from engine-lanes facade and smaller modules can surface widespread type errors; stay under `BATCH_MODULE_LOC_LIMIT` (500) with compact JSDoc/casts.
**Score:** 5/8 — Blast radius: 3, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** #266 Phase 2 / #283 — engine-lanes still nocheck after Phase 1 (SP-750). Start with smaller modules + facade before review-* and matrix/merge clusters.

## Mission

Partial #283 — Remove `@ts-nocheck` from the engine-lanes **facade** and **small** modules listed in File Scope. Add JSDoc/`Record<string, any>` patterns as needed so `npx tsc --project tsconfig.batch.json --noEmit` passes with those files included. Expand `tsconfig.batch.json` include and shrink SP-749 allowlist entries **only** for this task's modules. Leave review-* and matrix/merge nocheck for SP-771/SP-772.

## Dependencies

- **None**

## Context to Read First

- GitHub #283 — Phase 2 scope + SP-750 constraints
- `spine-tasks/SP-750-ts-nocheck-phase1-typing/PROMPT.md` — typing pattern
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`
- Target modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/engine-lanes/review.mjs`
- `src/batch/engine-lanes/phase.mjs`
- `src/batch/engine-lanes/review-stub.mjs`
- `src/batch/engine-lanes/orch-sync.mjs`
- `src/batch/engine-lanes/commit.mjs`
- `src/batch/engine-lanes/queue.mjs`
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && npx tsc --project tsconfig.batch.json --noEmit && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes.mjs`, `src/batch/engine-lanes/commit.mjs`, `src/batch/engine-lanes/queue.mjs`, `tsconfig.batch.json`, `tests/arch/ts-nocheck-guard.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm each File Scope module still has `@ts-nocheck` (except any already clean)
- [ ] Note current `tsconfig.batch.json` include + allowlist entries for these paths
- [ ] Dependencies satisfied

### Step 1: Type small engine-lanes + facade

- [ ] Remove `@ts-nocheck` from listed modules; add compact JSDoc / casts
- [ ] Expand `tsconfig.batch.json` include for cleaned modules
- [ ] Shrink allowlist entries for cleaned modules only
- [ ] Do not grow `PHASE23_GRANDFATHERED_OVER_500`
- [ ] Leave review-plan/final/code/poll and matrix/merge/matrix-run untouched

**Artifacts:**
- Listed `src/batch/engine-lanes*` modules (modified)
- `tsconfig.batch.json` (modified)
- `tests/arch/ts-nocheck-guard.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures (unset `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` if nested-spawn guard trips)

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- None (docs deferred to SP-773)

**Check If Affected:**

- `docs/QUICK-REFERENCE.md` — only if tsconfig.batch include list is documented

## Completion Criteria

- [ ] Listed modules pass batch tsc without nocheck
- [ ] Allowlist shrunk for those modules only
- [ ] Contract green
- [ ] Partial #283

## Git Commit Convention

- `refactor(SP-770): type small engine-lanes modules + facade (#283)`

## Do NOT

- Type review-plan/final/code/poll (SP-771)
- Type matrix.mjs / matrix-run.mjs / merge.mjs (SP-772)
- Type reconcile/doctor clusters (#284)
- Migrate the repo to full TypeScript
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
