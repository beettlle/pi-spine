# Task: SP-774 — Type reconcile-batch/orphan + reconcile facade (#284)

**Created:** 2026-09-26
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Removing `@ts-nocheck` from the reconcile entry path can surface ~76 type errors; `reconcile-batch.mjs` is 492/500 policy LOC so fixes must be inline casts, not new JSDoc blocks.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** #266 Phase 3 / #284 — reconcile/doctor still nocheck after Phase 2 (SP-770–772). Start with the batch/orphan reconcile path + the `reconcile.mjs` facade before classify/diagnosis (SP-775) and doctor (SP-776).

## Mission

Partial #284 — Remove `@ts-nocheck` from `src/batch/reconcile.mjs`, `src/batch/reconcile-batch.mjs`, and `src/batch/reconcile-orphan.mjs`. Add compact JSDoc / `Record<string, any>` / inline casts so `npx tsc --project tsconfig.batch.json --noEmit` passes with those files included. Add the three paths to `tsconfig.batch.json` include and remove **only** their entries from `NOCHECK_ALLOWLIST` in `tests/arch/ts-nocheck-guard.test.mjs`. No runtime behavior change.

Probe at `9942b782` (operator, throwaway worktree): with nocheck stripped, `reconcile-batch.mjs` shows 43 errors, `reconcile-orphan.mjs` 33, `reconcile.mjs` 0.

## Dependencies

- **None**

## Context to Read First

- GitHub #284 — scope + SP-750 constraints
- `spine-tasks/SP-770-type-engine-lanes-small/STATUS.md` — Discoveries table (typing patterns that worked)
- `src/batch/state-guards.mjs` — `Record<string, any>` pattern for mutated batch-state objects
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`
- `src/config/preflight/loc-capstone.mjs` — `BATCH_MODULE_LOC_LIMIT` (500, wc-l + 1 basis)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`) — worker-session env trips the SP-482 nested-spawn guard inside test subprocesses

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/reconcile-batch.mjs`
- `src/batch/reconcile-orphan.mjs`
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && npx tsc --project tsconfig.batch.json --noEmit && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs tests/batch/reconcile.test.mjs tests/batch/orphan-reconcile.test.mjs tests/batch/reconcile-git-error.test.mjs tests/batch/reconcile-done-inlane-terminal.test.mjs` |
| fileScopeMustChange | `src/batch/reconcile-batch.mjs`, `src/batch/reconcile-orphan.mjs`, `tsconfig.batch.json`, `tests/arch/ts-nocheck-guard.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm each File Scope module still has `@ts-nocheck` on line 1
- [ ] Note current `tsconfig.batch.json` include + `NOCHECK_ALLOWLIST` entries for these paths
- [ ] Record `wc -l src/batch/reconcile-batch.mjs` baseline (expected 492)
- [ ] Dependencies satisfied

### Step 1: Type reconcile facade + batch/orphan

- [ ] Remove `@ts-nocheck` from the three modules; fix surfaced errors with compact JSDoc / `Record<string, any>` / inline `/** @type {any} */` casts
- [ ] Add the three paths to `tsconfig.batch.json` include (before `types/micromatch.d.ts`)
- [ ] Remove the three entries from `NOCHECK_ALLOWLIST` only (allowlist only shrinks)
- [ ] Keep `reconcile-batch.mjs` ≤ 499 lines (`wc -l`); do not grow `PHASE23_GRANDFATHERED_OVER_500`
- [ ] Leave `reconcile-classify.mjs`, `reconcile-diagnosis*.mjs`, `reconcile-light-cache.mjs`, and `run-doctor-checks.mjs` untouched

**Artifacts:**
- `src/batch/reconcile.mjs`, `src/batch/reconcile-batch.mjs`, `src/batch/reconcile-orphan.mjs` (modified)
- `tsconfig.batch.json` (modified)
- `tests/arch/ts-nocheck-guard.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run full suite with worker env unset: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md (patterns, casts used, LOC after)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- None (docs deferred to SP-777)

**Check If Affected:**

- None

## Completion Criteria

- [ ] `reconcile.mjs`, `reconcile-batch.mjs`, `reconcile-orphan.mjs` pass batch tsc without nocheck
- [ ] Allowlist shrunk for those three modules only
- [ ] `reconcile-batch.mjs` under the 500 policy LOC limit
- [ ] Contract green
- [ ] Partial #284

## Git Commit Convention

- `refactor(SP-774): type reconcile-batch/orphan + reconcile facade (#284)`

## Do NOT

- Type `reconcile-classify.mjs`, `reconcile-diagnosis*.mjs`, `reconcile-light-cache.mjs` (SP-775)
- Type `src/doctor/run-doctor-checks.mjs` (SP-776)
- Change runtime behavior or exported signatures
- Edit `package.json` / `package-lock.json` (SP-778)
- Migrate the repo to full TypeScript
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
