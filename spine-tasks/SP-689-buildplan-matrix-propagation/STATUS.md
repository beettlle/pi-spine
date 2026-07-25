# Task Status: SP-689 — Propagate matrix fields through buildPlan

## Current State

**Overall Status:** 🟡 In Progress

## Plan (Review Level 1 — Plan Only)

**Step 1 — Propagate matrix into buildPlan + dedupe lanes.mjs:**
- `src/planner/index.mjs`: conditionally spread `prompt.matrix` + `prompt.matrixColumns`
  into `tasksById[taskId]` (matches `parsePrompt`'s conditional emission → non-matrix
  tasks untouched). Purely additive; no signature/return-shape change for existing
  HIGH-risk callers (startBatch, buildSequencePlan, runPreflightPlanCheck).
- `src/planner/lanes.mjs`: replace divergent `assignLanesToWaves` (directory-prefix
  overlap only) with a thin re-export of the canonical glob-aware impl in `waves.mjs`.
  Impact analysis: 0 upstream callers (test-only). Traced all 3 importing test files —
  waves.mjs version is a strict superset and satisfies every assertion.

**Step 2 — Tests:** add a real-`buildPlan` regression (fixture tasks root with `## Matrix`)
  asserting `SP-X[rowId]` virtual sub-lanes expand; keep existing unit tests.

**Step 3 — Docs:** rewrite runbook §2.4 "Planner packing" caveat (currently says buildPlan
  does NOT copy matrix fields) to match new plan output.

## Steps

### Step 0: Preflight
**Status:** ✅ Done
- [x] Confirm `loadTaskPacket` / parse-prompt already expose `matrix` / `matrixColumns`
- [x] Confirm `buildPlan` omits those fields from `tasksById`
- [x] Confirm `plan-matrix.test.mjs` currently injects fields manually

### Step 1: Propagate matrix into buildPlan
**Status:** ⬜ Not Started
- [ ] Copy `matrix` / `matrixColumns` into `tasksById`
- [ ] Deduplicate `lanes.mjs` duplicate into thin re-export

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Real `buildPlan` matrix expansion regression
- [ ] Contract `testCommand` green

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Runbook §2.4 update
- [ ] `.DONE`

## Discoveries

| Finding | Detail |
|---------|--------|
| `buildPlan` blast radius | HIGH (startBatch, buildSequencePlan, runPreflightPlanCheck, runSpineSequence) — change is additive only, contained to matrix path |
| `lanes.mjs` vs `waves.mjs` | Two divergent `assignLanesToWaves`; lanes.mjs lacks glob-aware overlap. Production (planWaves) uses waves.mjs. lanes.mjs is test-only. |
