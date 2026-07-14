# SP-658: Diagnose headline honesty — Status

**Current Step:** Step 1 — Headline preference + tests
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Read buildHeadline preference branches
- [x] Find existing #195 tests to extend

### Step 1: Headline preference + tests
**Status:** 🔄 In Progress
- [x] Prefer orphan/gating over stale gitignored headline
- [x] Keep gitignored in signals
- [x] Add orphan + stale gitignored fixture

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Close #205 when criteria met

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `buildHeadline` early-returns on `mergeGitignoredFailure` unless gate-ready (#195); orphan diagnoses still lose to stale gitignored | Added `shouldPreferPrimaryOverGitignoredHeadline` — gate-ready + `worker_orphaned`/`engine_orphaned` demote stale gitignored |
| #195 tests live in `tests/batch/diagnosis.test.mjs` and `merge-failure-diagnosis.test.mjs` | New scoped file `diagnosis-headline-honesty.test.mjs` extends that preference |
| Reconcile keeps `signals.mergeGitignoredFailure` true while demoting ctx only for gate-ready | Demotion in buildHeadline/buildSuggestedCommand; signals path unchanged |

## Completion Criteria

- [x] Headline honesty for orphan vs gitignored
- [ ] #205 closable
- [ ] Scoped tests green

## Blockers

_None._
