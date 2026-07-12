# SP-624: Validate targetRevision on gate use — Status

**Current Step:** Step 0 — Preflight
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** 🟡 In Progress
- [x] Required files and paths exist
- [x] Dependencies satisfied (SP-623 `.DONE` + `gate-revision.mjs` present)

### Step 1: Validate on check / integrate
**Status:** ⬜ Not Started
- [ ] Compare current revision to `gate.targetRevision` before treating gate as usable
- [ ] On drift: return fail-closed GateBlocked (clear wording); do not integrate
- [ ] Cover match + mismatch in unit tests

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

## Blockers

_None._

## Notes / Plan (Step 1)

1. Add `assertGateTargetRevisionCurrent` (or similar) in `gate-revision.mjs` using `resolveGateTargetRevision`.
2. In `checkIntegrateGate`, when `gate.status === "approved"`, compare pinned `targetRevision` to current orch tip; on mismatch/missing pin → GateBlocked exit 2 with re-open/re-approve wording.
3. Optionally pass `batchState` from `integrate.mjs` (load fallback inside check).
4. Unit tests: match allows; drift after new orch commit blocks.
