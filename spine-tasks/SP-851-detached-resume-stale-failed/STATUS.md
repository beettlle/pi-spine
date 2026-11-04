# SP-851: Detached resume ignores the batch's pre-resume failed state — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-11-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `waitForDetachedBatchResume`; report the blast radius in STATUS

### Step 1: Fix the ordering
**Status:** ✅ Complete

- [x] `failed` / `aborted` are engine failures only with `updatedAt > updatedAtBefore`

### Step 2: Tests
**Status:** ✅ Complete

- [x] Stale `failed` then fresh `running` → `engine_started`
- [x] Fresh `failed` / `aborted` → `batch_engine_failed`

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-851-detached-resume-stale-failed/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| GitNexus impact `waitForDetachedBatchResume` (upstream): **LOW risk** — 1 direct caller `resumeBatchDetached` (src/batch/detached-run.mjs:276), 1 process affected (`ResumeBatchDetached`), 1 module (Batch). Test callers: detached-start.test.mjs, detached-resume-gate.test.mjs. | recorded | src/batch/detached-wait.mjs:290 |
| `saveSpineBatchState` bumps `updatedAt` to `Date.now()` on every persist (state-io.mjs:140) — tests must capture `updatedAtBefore` from the reloaded on-disk state, not the in-memory object. | mitigated | tests/batch/detached-start.test.mjs (SP-851 tests) |
| Pre-existing failure: `batch start returns quickly and runs engine in background` (detached-start.test.mjs:110) times out after 30s spawning a real detached engine — reproduced on base commit 9258edd0, unrelated to SP-851. | documented | tests/batch/detached-start.test.mjs:110 |
| Full `npm test` inside a worker session fails 61 engine-spawn tests via the `SPINE_IS_WORKER=1` nested-batch guard; with the var unset (CI parity) all **3202/3202 pass**. `npm run typecheck` clean. | verified | repo-wide |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |
| 2026-11-03 | Step 0 | GitNexus impact LOW risk (1 caller) |
| 2026-11-03 | Step 1 | Freshness gate added in detached-wait.mjs (commit 22f24d12) |
| 2026-11-03 | Step 2 | 4 SP-851 tests added, all pass |
| 2026-11-03 | Step 3 | typecheck clean; 3202/3202 pass; coverage 91.35% ≥ 77% |
| 2026-11-03 | Step 4 | worker-verify.sh exit 0; .DONE created |

## Blockers

*None*
