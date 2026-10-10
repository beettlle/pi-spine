# SP-816: Deflake detached-start orphan-timeout test — Status

**Current Step:** Step 3: Documentation & Delivery
**Status:** ✅ Complete
**Last Updated:** 2026-10-03
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Dependencies satisfied

### Step 1: Exit marker + dead PID
**Status:** ✅ Complete

- [x] Marker
- [x] Dead PID before reconcile

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Lint (`npm run lint` — clean, exit 0)
- [x] Contract `testCommand` ×5 — 5/5 runs exit 0, `pass 2 fail 0` each
- [x] Fix all failures (none)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `recordBatchEnginePid` (src/batch/state-guards.mjs:158) mutates state in place; test 1's load→overwrite→save pattern reused directly for `raw` from `loadSpineBatchState`. |
| 2 | `isProcessAlive` import removed — no longer referenced anywhere in the file after replacing the PID-liveness assertion with the exit-marker check. |
| 3 | Fake engine exits after 50 ms, long before `startBatchDetached` returns on the ~30 s waitTerminal timeout, so the marker exists by assertion time without extra polling. |
| 4 | Verified 5 consecutive full Contract testCommand runs, all exit 0 (each ~32 s, dominated by the waitTerminal timeout). |

## Blockers

_None._
