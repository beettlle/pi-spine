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
**Status:** ⬜ Not Started
- [ ] Reproduce #221 signal shape
- [ ] Trace RUNNING_PHASES fallthrough

### Step 1: Diagnose needs_integrate for gate-pending land loop
**Status:** ⬜ Not Started
- [ ] Return needs_integrate for orch-ahead terminal-success land loop
- [ ] suggestedCommand spine gate approve when gate pending
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
| | |

## Completion Criteria

- [ ] Gate pending + terminal-success + orch ahead → `needs_integrate`
- [ ] `suggestedCommand` is `spine gate approve` when gate pending
- [ ] Regression covers #221 snapshot shape

## Blockers

_None yet._
