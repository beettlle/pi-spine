# SP-623: Persist targetRevision on gate open — Status

**Current Step:** Step 0 — Preflight
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
- [x] Dependencies satisfied

### Step 1: Persist helper + open wiring
**Status:** ⬜ Not Started
- [ ] Add helper to resolve orch tip SHA (or documented fallback) as `targetRevision`
- [ ] Set `targetRevision` on new gate records in `openIntegrateGate`
- [ ] Atomic save via existing gate I/O

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
| `gate-revision.mjs` does not exist yet | Create new helper module in File Scope |
| Real-pi session (`SPINE_WORKER_RUNNER` set) | Engine owns plan/code/final review after `.DONE`; in-worker `spine_review_step` returns skipped |
| Revision source | Orch tip SHA via `git rev-parse` on `batchState.orchBranch`; fail closed if unreadable |
| Impact `openIntegrateGate` | LOW risk; callers via `openIntegrateGateAfterBatchComplete` |

## Plan (Step 1)

1. Add `resolveGateTargetRevision(projectRoot, batchState)` in `src/batch/gate-revision.mjs` using `gitExec` + `rev-parse --verify` on `orchBranch`; throw if missing/unreadable.
2. Call helper in `openIntegrateGate` before first `saveGateRecord`; set `gate.targetRevision`.
3. Add `tests/batch/gate-target-revision-persist.test.mjs` asserting field after open + fail-closed paths.

## Blockers

_None._
