# SP-632: Wire posture evaluator into approve path — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Required files and paths exist
- [x] Dependencies satisfied

### Step 1: Wire evaluator + safety tests
**Status:** ✅ Complete
- [x] Call evaluator before/during approve when category/config present
- [x] Auto path journals decidedBy auto; locked never auto
- [x] Tests: default locked, opted-in auto, release/safety coexistence

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Run contract `testCommand`
- [x] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [x] Fix all failures

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress
- [x] Must Update docs modified (if any) — None required
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Explore: integrate category mapped to locked until config opts in | Auto-approve only when `gates.postures[category]` is explicitly present; bare DEFAULT_POSTURES must not unlock integrate |
| `approveIntegrateGate` GitNexus impact HIGH | Additive `maybeAutoApproveIntegrateGate`; human path keeps `decidedBy: human` |
| Real-pi worker (`SPINE_WORKER_RUNNER` set) | Engine owns plan/code/final review after `.DONE`; in-worker review skipped |
| `gate.mjs` exceeded 500 LOC after wiring | Extracted approve/reject/auto to `gate-posture-approve.mjs` (required for batch-loc-policy); re-exported from `gate.mjs` |
| Full suite under `SPINE_IS_WORKER=1` | Unset worker env for `npm test` / coverage; failures were nested_batch_spawn_blocked, not product regressions |

## Notes

**Step 1:** `maybeAutoApproveIntegrateGate` + land-loop posture path; journal `decidedBy`; streak on approve/reset on reject.
**Step 2:** Contract 14/14; full suite 2085/2085 (worker env cleared); coverage 89.16%.

## Blockers

_None._
