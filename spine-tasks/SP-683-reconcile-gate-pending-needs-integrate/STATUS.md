# SP-683: Reconcile gate-pending needs_integrate — Status

**Current Step:** Step 0 — Preflight
**Status:** ⬜ Not Started
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
**Status:** 🔄 In Progress
- [x] Return needs_integrate for orch-ahead terminal-success land loop
- [x] suggestedCommand spine gate approve when gate pending
- [ ] Fail-closed for truly running workers

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Regression for #221 snapshot shape
- [ ] Wait taxonomy match without pseudos
- [ ] Contract testCommand
- [ ] Fix scoped failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `isPostMergeLimbo` requires raw task status `"succeeded"`; tasks classified `terminal-success` via `doneFileFound` with raw status `"running"` leave `postMergeLimbo` false. | Add a `deriveDiagnosis` branch before `RUNNING_PHASES` fallthrough based on `allTasksTerminalSuccess` + orch ahead + no active workers, set `signals.postMergeLimbo = true`, and make `buildSuggestedCommand` prefer `spine gate approve` when `integrateGateOpen`. |

## Completion Criteria

- [ ] Gate pending + terminal-success + orch ahead → `needs_integrate`
- [ ] `suggestedCommand` is `spine gate approve` when gate pending
- [ ] Regression covers #221 snapshot shape

## Blockers

_None yet._
