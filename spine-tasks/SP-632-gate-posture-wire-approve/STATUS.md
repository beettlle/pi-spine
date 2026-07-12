# SP-632: Wire posture evaluator into approve path — Status

**Current Step:** Step 0 — Preflight
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** 🟡 In Progress
- [x] Required files and paths exist
- [x] Dependencies satisfied

### Step 1: Wire evaluator + safety tests
**Status:** ⬜ Not Started
- [ ] Call evaluator before/during approve when category/config present
- [ ] Auto path journals decidedBy auto; locked never auto
- [ ] Tests: default locked, opted-in auto, release/safety coexistence

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Must Update docs modified (if any)
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Explore: integrate category mapped to locked until config opts in | Auto-approve only when `gates.postures[category]` is explicitly present; bare DEFAULT_POSTURES must not unlock integrate |
| `approveIntegrateGate` GitNexus impact HIGH | Additive `maybeAutoApproveIntegrateGate`; human path keeps `decidedBy: human` |
| Real-pi worker (`SPINE_WORKER_RUNNER` set) | Engine owns plan/code/final review after `.DONE`; in-worker review skipped |

## Blockers

_None._
