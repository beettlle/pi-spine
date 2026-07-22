# SP-683: Reconcile gate-pending needs_integrate — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Reproduce #221 signal shape
- [x] Trace RUNNING_PHASES fallthrough

**Discoveries:** `deriveDiagnosis` falls through to `RUNNING_PHASES` because `isPostMergeLimbo` requires raw task status `"succeeded"`; when tasks are classified `terminal-success` via `doneFileFound` but raw status is still `"running"`, `postMergeLimbo` is false and the existing `needs_integrate` branches don't match `phase: running` with `mergeResultsEmpty: false`.

### Step 1: Diagnose needs_integrate for gate-pending land loop
**Status:** ✅ Complete
- [x] Return needs_integrate for orch-ahead terminal-success land loop
- [x] suggestedCommand spine gate approve when gate pending
- [x] Fail-closed for truly running workers

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Regression for #221 snapshot shape
- [x] Wait taxonomy match without pseudos
- [x] Contract testCommand
- [x] Fix scoped failures

**Test evidence:** `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/diagnosis.test.mjs tests/cli/spine-wait-diagnosis.test.mjs` — 26 tests passed, 0 failed.

### Step 3: Documentation & Delivery
**Status:** 🔄 In Progress
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `isPostMergeLimbo` requires raw task status `"succeeded"`; tasks classified `terminal-success` via `doneFileFound` with raw status `"running"` leave `postMergeLimbo` false. | Add a `deriveDiagnosis` branch before `RUNNING_PHASES` fallthrough based on `allTasksTerminalSuccess` + orch ahead + no active workers, set `signals.postMergeLimbo = true`, and make `buildSuggestedCommand` prefer `spine gate approve` when `integrateGateOpen`. |

## Completion Criteria

- [x] Gate pending + terminal-success + orch ahead → `needs_integrate`
- [x] `suggestedCommand` is `spine gate approve` when gate pending
- [x] Regression test covers the #221 snapshot shape

## Blockers

_None yet._
