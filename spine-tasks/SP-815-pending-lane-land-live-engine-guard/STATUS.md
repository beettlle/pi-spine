# SP-815: No salvage recommendation under a live engine — Status

**Current Step:** Step 1: Guard
**Status:** 🟡 In Progress
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
**Status:** ⬜ Not Started

- [ ] Helper + early return

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Five cases

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Coverage gate
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `shouldDiagnosePendingLaneLand`: LOW risk; only production caller is `deriveDiagnosis` (`reconcile-diagnosis.mjs:207`); re-exported via `diagnosis.mjs:68`. |
| 2 | Importers of `diagnosis-pending-lane.mjs`: `diagnosis.mjs`, `lifecycle.mjs`, `diagnosis-suggested-command.mjs`, `reconcile-diagnosis-context.mjs`, `reconcile-diagnosis.mjs`. New imports `state-guards.mjs` (fs/path/liveness only) and `liveness.mjs` (node builtins only) are leaves — no cycle (verified against `tests/arch/import-cycles.test.mjs` allowlist which is empty). |
| 3 | `signals.raw` confirmed as raw batch state at `reconcile-batch.mjs:178` and `:253`; engine pid lives at `raw.resilience.enginePid` / top-level `raw.enginePid` (`state-guards.mjs:117-137`); missing `engineStartedAt` degrades to PID-only liveness (`liveness.mjs:184+`). |
| 4 | Guarded fall-through for #330 shape ends at diagnosis `running` (`RUNNING_PHASES` has "running"; `LIMBO_PHASES` = {stopped, failed, executing} does not; `isPostMergeLimbo` false because a raw task is `running` and `orchMergedToBase` true). |

## Blockers

_None._
