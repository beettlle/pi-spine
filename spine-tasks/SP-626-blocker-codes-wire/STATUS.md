# SP-626: Wire structured blockers into gate checks — Status

**Current Step:** Step 1: Wire blockers on blocked paths
**Status:** ✅ Complete
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Required files and paths exist
- [x] Dependencies satisfied

### Step 1: Wire blockers on blocked paths
**Status:** ✅ Complete
- [x] Attach `blockers` array (or single blocker) on fail-closed gate check paths
- [x] Include stale-revision code when SP-624 drift path fires
- [x] Tests assert codes without breaking headline strings

### Step 2: Testing & Verification
**Status:** 🟡 In Progress
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
| `tests/batch/blocker-codes-wire.test.mjs` missing | Created with 7 wire tests |
| GitNexus impact HIGH on `checkIntegrateGate` | Additive `blockers` only; keep `error`/`headline` unchanged |
| SP-624/SP-625 `.DONE` present | Dependencies satisfied |
| Plan review nested spawn | Skipped (engine-owned after `.DONE`) |

## Blockers

_None._

## Notes / Plan (Review Level 1)

**Step 1 plan:** Import `makeBlocker` into `gate.mjs`. Attach `blockers: [makeBlocker(code, errorMessage)]` on every `checkIntegrateGate` fail-closed return (`force_integrate_blocked`, `missing_gate`, `stale_revision`, `gate_rejected`, `gate_pending`). Mirror `missing_gate` / `gate_rejected` on `approveIntegrateGate` fail paths. New wire test asserts codes + unchanged headlines.
