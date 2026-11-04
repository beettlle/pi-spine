# SP-856: Integrate and batch complete tell the operator to wait while the engine finishes its land loop — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `reloadStateForTerminalWrite`, `formatLifecycleHuman`, and the integrate result builder; report the blast radius in STATUS
- [x] `rg -n "batch_state_changed_during_terminal_write|suggestedCommand: \"spine batch complete\"" tests/` — list assertions that change

### Step 1: Complete refusal + headline
**Status:** 🟡 In Progress

- [ ] Live-engine active-phase refusal returns `engine_finishing_land_loop`, `pending: true`, wait suggestion
- [ ] `formatLifecycleHuman` prints `Batch lifecycle pending` for pending results

### Step 2: Integrate suggestion
**Status:** ⬜ Not Started

- [ ] Live engine in an active phase → `spine wait --until completed --timeout 10m`, `spine batch complete` in alternatives

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Complete with live / dead engine PID
- [ ] Integrate with live engine

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-856-integrate-live-engine-wait/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Impact `reloadStateForTerminalWrite`: GitNexus HIGH — 3 direct callers: `completeBatch.inLock` (lifecycle.mjs:438), `dismissBatch.inLock` (lifecycle.mjs:217), `abortBatch.inLock` (abort.mjs:233). New behavior guarded to the `requireTerminalPhase && !force` active-phase branch; abort never passes it, and dismiss/complete fixtures in existing tests carry no engine PID (default liveness → dead), so their generic refusals are unchanged. | Noted | src/batch/lifecycle-archive.mjs |
| `formatLifecycleHuman` missing from GitNexus index (24 commits stale); grep found its only callers in `bin/spine-batch.mjs` (3 result-render sites). Headline prefix switches on `pending` only; nothing else sets `pending: true` today. | Noted | bin/spine-batch.mjs |
| Integrate result builder is `integrateOrchToBase`; `suggestedCommand: "spine batch complete"` returned at integrate.mjs:166 (already-merged) and :408 (success). `rg` found no test asserting those two suggestions; `tests/cli/sequence.test.mjs:131` matches `sequence-plan.mjs` output (untouched). Generic-refusal assertions (lifecycle.test.mjs:352/449, abort.test.mjs:410/452) use PID-less fixtures → unchanged. | Noted | tests/ |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |
| 2026-11-03 | Step 0 complete | Impact + refusal-assertion audit logged in Discoveries |

## Blockers

*None*
