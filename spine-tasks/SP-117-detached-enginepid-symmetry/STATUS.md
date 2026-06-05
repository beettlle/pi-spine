# SP-117: Detached enginePid symmetry — Status

**Current Step:** Step 1 — Symmetric persistence
**Status:** 🟡 In Progress
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
**Status:** 🟡 In Progress
- [x] persistDetachedEnginePid immediately after spawn on start path

### Step 2: Regression test
**Status:** ⬜ Not Started
- [ ] Fixture: timeout_waiting_for_batch + dead engine → reconcile ≠ running

### Step 3: Testing & Verification
**Status:** ⬜ Not Started
- [ ] FULL suite + coverage gate

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
