# SP-623: Persist targetRevision on gate open — Status

**Current Step:** Step 3 — Documentation & Delivery
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

### Step 1: Persist helper + open wiring
**Status:** ✅ Complete
- [x] Add helper to resolve orch tip SHA (or documented fallback) as `targetRevision`
- [x] Set `targetRevision` on new gate records in `openIntegrateGate`
- [x] Atomic save via existing gate I/O

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Run contract `testCommand`
- [x] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [x] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Must Update docs modified (if any)
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `gate-revision.mjs` does not exist yet | Create new helper module in File Scope |
| Real-pi session (`SPINE_WORKER_RUNNER` set) | Engine owns plan/code/final review after `.DONE`; in-worker `spine_review_step` returns skipped |
| Revision source | Prefer orch tip SHA; documented fallback to HEAD when orch tip unreadable; fail closed if neither readable |
| Impact `openIntegrateGate` | LOW risk; callers via `openIntegrateGateAfterBatchComplete` |
| Full suite under worker env | Unset `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` for suite and coverage (nested batch guard) |
| Coverage | 88.84% line (threshold 77%) |

## Completion Criteria

- [x] Gate records include `targetRevision` after open
- [x] Regression test covers persist path

## Blockers

_None._
