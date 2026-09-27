# Task: SP-775 — Type reconcile classify/diagnosis/context/light-cache (#284)

**Created:** 2026-09-26
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Diagnosis/classify modules drive `spine status --diagnose` and recovery recommendations; ~119 type errors surface once nocheck is removed. Typing must not change classification output.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** #266 Phase 3 / #284 second slice — after SP-774 types the reconcile entry path, type the classification + diagnosis cluster it calls.

## Mission

Partial #284 — Remove `@ts-nocheck` from `src/batch/reconcile-classify.mjs`, `src/batch/reconcile-diagnosis.mjs`, `src/batch/reconcile-diagnosis-context.mjs`, and `src/batch/reconcile-light-cache.mjs`. Add compact JSDoc / `Record<string, any>` / inline casts so `npx tsc --project tsconfig.batch.json --noEmit` passes with those files included. Add the four paths to `tsconfig.batch.json` include and remove **only** their entries from `NOCHECK_ALLOWLIST` in `tests/arch/ts-nocheck-guard.test.mjs`. No runtime behavior change.

Probe at `9942b782` (operator, throwaway worktree): with nocheck stripped, `reconcile-diagnosis.mjs` shows 50 errors, `reconcile-classify.mjs` 38, `reconcile-diagnosis-context.mjs` 31, `reconcile-light-cache.mjs` 0.

## Dependencies

- **Task:** SP-774 (shares `tsconfig.batch.json` + arch allowlist; reconcile-batch types must be on `main`)

## Context to Read First

- GitHub #284 — scope + SP-750 constraints
- `spine-tasks/SP-774-type-reconcile-batch-orphan/STATUS.md` — Discoveries from the first #284 slice
- `src/batch/state-guards.mjs` — `Record<string, any>` pattern
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`) — worker-session env trips the SP-482 nested-spawn guard inside test subprocesses

## File Scope

- `src/batch/reconcile-classify.mjs`
- `src/batch/reconcile-diagnosis.mjs`
- `src/batch/reconcile-diagnosis-context.mjs`
- `src/batch/reconcile-light-cache.mjs`
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && npx tsc --project tsconfig.batch.json --noEmit && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs tests/batch/diagnosis.test.mjs tests/batch/diagnosis-failure-class.test.mjs tests/batch/diagnosis-orphan-taxonomy.test.mjs tests/batch/reconcile-light.test.mjs tests/batch/macro-phase.test.mjs` |
| fileScopeMustChange | `src/batch/reconcile-classify.mjs`, `src/batch/reconcile-diagnosis.mjs`, `src/batch/reconcile-diagnosis-context.mjs`, `tsconfig.batch.json`, `tests/arch/ts-nocheck-guard.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-774 `.DONE` and its three modules in `tsconfig.batch.json`
- [ ] Confirm each File Scope module still has `@ts-nocheck` on line 1
- [ ] Dependencies satisfied

### Step 1: Type classify/diagnosis cluster

- [ ] Remove `@ts-nocheck` from the four modules; fix surfaced errors with compact JSDoc / `Record<string, any>` / inline casts
- [ ] Add the four paths to `tsconfig.batch.json` include (before `types/micromatch.d.ts`)
- [ ] Remove the four entries from `NOCHECK_ALLOWLIST` only (allowlist only shrinks)
- [ ] Every touched `src/batch/*.mjs` stays under 500 policy LOC; do not grow `PHASE23_GRANDFATHERED_OVER_500`
- [ ] Leave `src/doctor/run-doctor-checks.mjs` and SP-774 modules untouched unless a signature fix is strictly required (log in STATUS)

**Artifacts:**
- Four `src/batch/reconcile-*.mjs` modules (modified)
- `tsconfig.batch.json` (modified)
- `tests/arch/ts-nocheck-guard.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run full suite with worker env unset: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- None (docs deferred to SP-777)

**Check If Affected:**

- None

## Completion Criteria

- [ ] Four modules pass batch tsc without nocheck
- [ ] Allowlist shrunk for those modules only
- [ ] Diagnosis output unchanged (diagnosis tests green)
- [ ] Contract green
- [ ] Partial #284

## Git Commit Convention

- `refactor(SP-775): type reconcile classify/diagnosis cluster (#284)`

## Do NOT

- Type `src/doctor/run-doctor-checks.mjs` (SP-776)
- Change diagnosis taxonomy, recommendations, or exported signatures
- Edit `package.json` / `package-lock.json`
- Migrate the repo to full TypeScript
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
