# SP-658: Diagnose headline honesty — Status

**Current Step:** Step 0 — Preflight
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** 🔄 In Progress
- [x] Read buildHeadline preference branches
- [x] Find existing #195 tests to extend

### Step 1: Headline preference + tests
**Status:** ⬜ Not Started
- [ ] Prefer orphan/gating over stale gitignored headline
- [ ] Keep gitignored in signals
- [ ] Add orphan + stale gitignored fixture

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
| `buildHeadline` early-returns on `mergeGitignoredFailure` unless gate-ready (#195); orphan diagnoses still lose to stale gitignored | Extend demotion for orphan diagnoses (`worker_orphaned` / `engine_orphaned`) + mirror in `buildSuggestedCommand` |
| #195 tests live in `tests/batch/diagnosis.test.mjs` and `merge-failure-diagnosis.test.mjs` | New scoped file `diagnosis-headline-honesty.test.mjs` extends that preference, not a fork of reconcile fixtures |
| Reconcile keeps `signals.mergeGitignoredFailure` true while demoting ctx only for gate-ready | Fix in `buildHeadline`/`buildSuggestedCommand` so signals stay; file scope excludes reconcile |

## Completion Criteria

- [ ] Headline honesty for orphan vs gitignored
- [ ] #205 closable
- [ ] Scoped tests green

## Blockers

_None._
