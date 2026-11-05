# SP-856: Integrate and batch complete tell the operator to wait while the engine finishes its land loop — Status

**Current Step:** Step 5
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
**Status:** ✅ Complete

- [x] Live-engine active-phase refusal returns `engine_finishing_land_loop`, `pending: true`, wait suggestion
- [x] `formatLifecycleHuman` prints `Batch lifecycle pending` for pending results

### Step 2: Integrate suggestion
**Status:** ✅ Complete

- [x] Live engine in an active phase → `spine wait --until completed --timeout 10m`, `spine batch complete` in alternatives

### Step 3: Tests
**Status:** ✅ Complete

- [x] Complete with live / dead engine PID
- [x] Integrate with live engine

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-856-integrate-live-engine-wait/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): 9ee685d  bin/spine-batch.mjs:115  WARNING  The ternary chain `result.ok ? ... : result.pending ? ... : ...` assumes that `result. | advisory — noted, not blocking | contract review step |
| Impact `reloadStateForTerminalWrite`: GitNexus HIGH — 3 direct callers: `completeBatch.inLock` (lifecycle.mjs:438), `dismissBatch.inLock` (lifecycle.mjs:217), `abortBatch.inLock` (abort.mjs:233). New behavior guarded to the `requireTerminalPhase && !force` active-phase branch; abort never passes it, and dismiss/complete fixtures in existing tests carry no engine PID (default liveness → dead), so their generic refusals are unchanged. | Noted | src/batch/lifecycle-archive.mjs |
| `formatLifecycleHuman` missing from GitNexus index (24 commits stale); grep found its only callers in `bin/spine-batch.mjs` (3 result-render sites). Headline prefix switches on `pending` only; nothing else sets `pending: true` today. | Noted | bin/spine-batch.mjs |
| Integrate result builder is `integrateOrchToBase`; `suggestedCommand: "spine batch complete"` returned at integrate.mjs:166 (already-merged) and :408 (success). `rg` found no test asserting those two suggestions; `tests/cli/sequence.test.mjs:131` matches `sequence-plan.mjs` output (untouched). Generic-refusal assertions (lifecycle.test.mjs:352/449, abort.test.mjs:410/452) use PID-less fixtures → unchanged. | Noted | tests/ |
| completeBatch left untouched (out of file scope): liveness injection is unit-tested directly against `reloadStateForTerminalWrite`; the e2e test uses a real spawned live PID, so no `lifecycle.mjs` change was needed. | Noted | src/batch/lifecycle.mjs |
| `skills/spine-release-operator/SKILL.md` §4.3 land loop: not edited (per PROMPT). Land-loop-wait guidance now lives in the integrate + complete outputs themselves; the skill can adopt it post-release. | Noted | skills/spine-release-operator/SKILL.md |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |
| 2026-11-03 | Step 0 complete | Impact + refusal-assertion audit logged in Discoveries |
| 2026-11-03 | Steps 1–3 | `isLiveEngineInActivePhase` + pending refusal (lifecycle-archive), pending headline (spine-batch), integrate wait suggestion (net +20, at budget), 7 new tests — 21/21 green |
| 2026-11-03 | Step 4 | Contract testCommand green: lint ✓, typecheck ✓, 35/35 tests pass, exit 0 |
| 2026-11-03 | Step 5 | `detect_changes(all)` = none (index intentionally stale); lane diff confined to the 5 in-scope files + STATUS |

## Blockers

*None*
