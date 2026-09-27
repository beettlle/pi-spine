# Task: SP-776 — Type run-doctor-checks (#284)

**Created:** 2026-09-26
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** `run-doctor-checks.mjs` orchestrates every `spine doctor` check; ~16 type errors once nocheck is removed. Typing only — check ids, messages, and ordering must not change.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** #266 Phase 3 / #284 final slice — after SP-774/SP-775 type the reconcile cluster, type the doctor runner so #284 acceptance criteria are met.

## Mission

Closes #284 — Remove `@ts-nocheck` from `src/doctor/run-doctor-checks.mjs`. Add compact JSDoc / inline casts so `npx tsc --project tsconfig.batch.json --noEmit` passes with it included. Add the path to `tsconfig.batch.json` include and remove **only** its entry from `NOCHECK_ALLOWLIST` in `tests/arch/ts-nocheck-guard.test.mjs`. No runtime behavior change.

Probe at `9942b782` (operator, throwaway worktree): with nocheck stripped, `run-doctor-checks.mjs` shows 16 errors. The file is in `src/doctor/` (597 lines) — `BATCH_MODULE_LOC_LIMIT` applies only to `src/batch/*.mjs`, but do not grow the file beyond what typing needs.

## Dependencies

- **Task:** SP-775 (shares `tsconfig.batch.json` + arch allowlist)

## Context to Read First

- GitHub #284 — acceptance criteria
- `spine-tasks/SP-775-type-reconcile-classify-diagnosis/STATUS.md` — Discoveries from prior slice
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`) — worker-session env trips the SP-482 nested-spawn guard inside test subprocesses

## File Scope

- `src/doctor/run-doctor-checks.mjs`
- `tsconfig.batch.json`
- `tests/arch/ts-nocheck-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && npx tsc --project tsconfig.batch.json --noEmit && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs tests/doctor/stale-worktrees.test.mjs tests/doctor/duplicate-install.test.mjs tests/doctor/list-models-timeout.test.mjs tests/cli/doctor-attached-orphan-warn.test.mjs` |
| fileScopeMustChange | `src/doctor/run-doctor-checks.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-775 `.DONE` and its modules in `tsconfig.batch.json`
- [ ] Confirm `run-doctor-checks.mjs` still has `@ts-nocheck` on line 1
- [ ] Dependencies satisfied

### Step 1: Type run-doctor-checks

- [ ] Remove `@ts-nocheck`; fix surfaced errors with compact JSDoc / inline casts
- [ ] Add the path to `tsconfig.batch.json` include (before `types/micromatch.d.ts`)
- [ ] Remove its `NOCHECK_ALLOWLIST` entry only (allowlist only shrinks)
- [ ] Confirm no #284 target remains allowlisted: `rg -n 'reconcile-(batch|orphan|classify|diagnosis|light-cache)|batch/reconcile\.mjs|run-doctor-checks' tests/arch/ts-nocheck-guard.test.mjs` returns nothing

**Artifacts:**
- `src/doctor/run-doctor-checks.mjs` (modified)
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

- [ ] `run-doctor-checks.mjs` passes batch tsc without nocheck
- [ ] No #284 target remains in `NOCHECK_ALLOWLIST`
- [ ] `spine doctor` behavior unchanged (doctor tests green)
- [ ] Contract green
- [ ] Closes #284

## Git Commit Convention

- `refactor(SP-776): type run-doctor-checks (#284)`

## Do NOT

- Type other `src/doctor/*.mjs` modules still on the allowlist (out of #284 scope)
- Change doctor check ids, messages, ordering, or exit codes
- Edit reconcile modules (SP-774/SP-775)
- Migrate the repo to full TypeScript
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- 2026-09-26: SP-774 already changed `tsconfig.batch.json` and `tests/arch/ts-nocheck-guard.test.mjs` on `main`. Both stay in File Scope and Step 1 still edits them, but `fileScopeMustChange` now lists only `src/doctor/run-doctor-checks.mjs` (prelanded-file-scope preflight warning).
