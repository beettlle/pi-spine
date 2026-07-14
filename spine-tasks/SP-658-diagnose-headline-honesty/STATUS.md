# SP-658: Diagnose headline honesty — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** ✅ Complete
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
**Status:** ✅ Complete
- [x] Prefer orphan/gating over stale gitignored headline
- [x] Keep gitignored in signals
- [x] Add orphan + stale gitignored fixture

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Run contract testCommand
- [x] Fix scoped failures
- [x] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create `.DONE`
- [x] Close #205 when criteria met

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `buildHeadline` early-returns on `mergeGitignoredFailure` unless gate-ready (#195); orphan diagnoses still lose to stale gitignored | Added `shouldPreferPrimaryOverGitignoredHeadline` — gate-ready + `worker_orphaned`/`engine_orphaned` demote stale gitignored |
| #195 tests live in `tests/batch/diagnosis.test.mjs` and `merge-failure-diagnosis.test.mjs` | New scoped file `diagnosis-headline-honesty.test.mjs` extends that preference |
| Reconcile keeps `signals.mergeGitignoredFailure` true while demoting ctx only for gate-ready | Demotion in buildHeadline/buildSuggestedCommand; signals path unchanged |
| `npm run coverage:check` fails under worker env (`SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER`) | Ran with those unset for gate: 88.80% ≥ 77% |

## Completion Criteria

- [x] Headline honesty for orphan vs gitignored
- [x] #205 closable
- [x] Scoped tests green

## Blockers

_None._

## Verification evidence

- Contract: `node --test tests/batch/diagnosis-headline-honesty.test.mjs` — 6/6 pass
- Coverage: `Line coverage (in-scope): 88.80% (threshold: 77%)`
- Issue: #205 closed (SP-656 + SP-657 + SP-658)
