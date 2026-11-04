# SP-851: Detached resume ignores the batch's pre-resume failed state — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
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
**Status:** ⬜ Not Started

- [ ] Stale `failed` then fresh `running` → `engine_started`
- [ ] Fresh `failed` / `aborted` → `batch_engine_failed`

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-851-detached-resume-stale-failed/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| GitNexus impact `waitForDetachedBatchResume` (upstream): **LOW risk** — 1 direct caller `resumeBatchDetached` (src/batch/detached-run.mjs:276), 1 process affected (`ResumeBatchDetached`), 1 module (Batch). Test callers: detached-start.test.mjs, detached-resume-gate.test.mjs. | recorded | src/batch/detached-wait.mjs:290 |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
