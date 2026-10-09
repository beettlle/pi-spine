# SP-815: No salvage recommendation under a live engine — Status

**Current Step:** Done
**Status:** ✅ Complete
**Last Updated:** 2026-10-09
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Impact analysis recorded
- [x] No import cycle
- [x] Dependencies satisfied

### Step 1: Guard
**Status:** ✅ Done

- [x] Helper + early return

### Step 2: Tests
**Status:** ✅ Done

- [x] Five cases

### Step 3: Testing & Verification
**Status:** ✅ Done

- [x] Lint
- [x] Contract `testCommand`
- [x] Coverage gate
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Done

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `shouldDiagnosePendingLaneLand`: LOW risk; only production caller is `deriveDiagnosis` (`reconcile-diagnosis.mjs:207`); re-exported via `diagnosis.mjs:68`. |
| 2 | Importers of `diagnosis-pending-lane.mjs`: `diagnosis.mjs`, `lifecycle.mjs`, `diagnosis-suggested-command.mjs`, `reconcile-diagnosis-context.mjs`, `reconcile-diagnosis.mjs`. New imports `state-guards.mjs` (fs/path/liveness only) and `liveness.mjs` (node builtins only) are leaves — no cycle (verified against `tests/arch/import-cycles.test.mjs` allowlist which is empty). |
| 3 | `signals.raw` confirmed as raw batch state at `reconcile-batch.mjs:178` and `:253`; engine pid lives at `raw.resilience.enginePid` / top-level `raw.enginePid` (`state-guards.mjs:117-137`); missing `engineStartedAt` degrades to PID-only liveness (`liveness.mjs:184+`). |
| 4 | Guarded fall-through for #330 shape ends at diagnosis `running` (`RUNNING_PHASES` has "running"; `LIMBO_PHASES` = {stopped, failed, executing} does not; `isPostMergeLimbo` false because a raw task is `running` and `orchMergedToBase` true). |
| 5 | Verification evidence: Contract testCommand 63/63 pass (exit 0, `node --test` over the six scoped test files); `npm run lint` exit 0; `npm run typecheck` exit 0; `npm run coverage:check` exit 0 — line coverage 90.06% ≥ 77% threshold, full suite 2774/2774 pass. `gitnexus detect_changes` (unstaged): low risk, only the two File-Scope files changed. |

## Blockers

_None._
