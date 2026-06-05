# SP-117: Detached enginePid symmetry — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Read source audit report(s)
- [x] Dependencies satisfied (SP-111 orphan detect foundation merged)

### Step 1: Symmetric persistence
**Status:** ✅ Complete
- [x] persistDetachedEnginePid immediately after spawn on start path

### Step 2: Regression test
**Status:** ✅ Complete
- [x] Fixture: timeout_waiting_for_batch + dead engine → reconcile ≠ running

### Step 3: Testing & Verification
**Status:** ✅ Complete
- [x] FULL suite + coverage gate

---

## Completion Criteria
- [x] Start and resume persist enginePid symmetrically
- [x] Timeout orphan test passes

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Resume path already persists enginePid at line 640 before wait | Reference for symmetry | `detached-start.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-05 | Task staged from Phase 20 audit synthesis | PROMPT.md created |
| 2026-06-05 | Step 0 preflight | SP-111 dependency satisfied; audit Finding #5/#12 scoped |
| 2026-06-05 | Step 1 implementation | Moved persistDetachedEnginePid before wait on start path |
| 2026-06-05 | Step 1 plan review | APPROVE |
| 2026-06-05 | Step 2 regression tests | 2/2 pass in detached-start-orphan-timeout.test.mjs |
| 2026-06-05 | Step 2 code review | APPROVE |
| 2026-06-05 | Step 3 verification | npm test 569/569 pass; coverage 83.69% (threshold 77%) |
