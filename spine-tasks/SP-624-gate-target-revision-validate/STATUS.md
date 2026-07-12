# SP-624: Validate targetRevision on gate use — Status

**Current Step:** Step 1 — Validate on check / integrate
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Required files and paths exist
- [x] Dependencies satisfied (SP-623 `.DONE` + `gate-revision.mjs` present)

### Step 1: Validate on check / integrate
**Status:** ✅ Complete
- [x] Compare current revision to `gate.targetRevision` before treating gate as usable
- [x] On drift: return fail-closed GateBlocked (clear wording); do not integrate
- [x] Cover match + mismatch in unit tests

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
| `checkIntegrateGate` impact HIGH (integrate + salvage) | Put revision check inside `checkIntegrateGate` so both paths fail closed without duplicating logic |
| SP-625/626 own blocker codes | Return `GateBlocked` with clear wording only; do not wire `stale_revision` blocker yet |
| Real-pi worker (`SPINE_WORKER_RUNNER` set) | Plan/code review skipped in-worker; engine reviews after `.DONE` |
| Gate path is `.spine/runtime/{batchId}/gate.json` | Tests use `gateRecordPath` |

## Blockers

_None._
