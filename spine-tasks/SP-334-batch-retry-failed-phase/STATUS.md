# SP-334: Batch retry failed-phase recovery — Status

**Current Step:** Step 4 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Issue #25 reviewed
- [x] File scope modules read

**Notes:** Optimator batch `20260622T220028`: worker death → `batch.failed` → retry reset task to pending but left `phase: failed` with `failedTasks: 0`, blocking preflight/resume.

---

### Step 1: Retry transitions batch to resumable phase
**Status:** ✅ Complete

- [x] Retry transitions batch to resumable phase

---

### Step 2: Diagnosis + runbook
**Status:** ✅ Complete

- [x] Diagnosis + runbook

---

### Step 3: Tests + delivery
**Status:** ✅ Complete

- [x] Tests + delivery

---

### Step 4: Testing & Verification
**Status:** 🟡 In Progress

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Close issue #25 (`gh issue close 25`)
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SP-134 fix not on origin/main; rework against current branch | In scope | GitHub #25 reopen comment |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-28 | Task staged | PROMPT.md and STATUS.md created for GitHub #25 |
| 2026-06-30 | Step 0–3 | Implemented unblockBatchAfterRetry, reconcile/resume/diagnosis fixes, regression test |

---

## Blockers

*None*

---

## Notes

- `retry.mjs`: `unblockBatchAfterRetry()` → `phase: paused` + `batch.retry_unblocked` journal when no failed tasks remain.
- `reconcile.mjs`: failed + pending-only → `needs_retry` (not terminal `failed`).
- `resume-multi-validate.mjs`: allow resume without `--force` for failed-phase pending-only limbo.
