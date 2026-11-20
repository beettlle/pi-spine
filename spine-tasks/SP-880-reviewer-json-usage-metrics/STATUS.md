# SP-880: Reviewer: pi --mode json usage on review metric rows — Status

**Current Step:** Step 3: Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-878 API + SP-837 emit sites
- [x] Impact on buildReviewMetricRecord

---

### Step 1: Reviewer JSON + metric fields
**Status:** ✅ Complete

- [x] --mode json + parse
- [x] Usage on review metric records

---

### Step 2: Fixture rollup test
**Status:** ✅ Complete

- [x] End-to-end fixture → metrics show / rollup

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract testCommand
- [ ] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries in STATUS
- [ ] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SP-878 API: `sumUsageFromPiJsonStream(input)` → `{tokensIn?, tokensOut?, estimatedUsd?}` (keys omitted when pi reports none); `extractTextFromPiJsonStream(input)` → human text segments | Confirmed | `src/batch/pi-json-usage.mjs` |
| SP-837 emit sites: `runReviewPollLoop` records spawn-failure rows (~L339) and verdict rows (~L392); third site `task-agent-profile.mjs` (~L293) is the blocked row (no spawn → no usage) | Confirmed | `src/batch/engine-lanes/review-poll.mjs` |
| Impact `buildReviewMetricRecord`: GitNexus UNKNOWN (symbol absent from index in this worktree) → confirmed via text search. Callers: `recordReviewMetric` (metrics.mjs) + direct test calls; `recordReviewMetric` callers: review-poll ×2, task-agent-profile ×1. `spawnReviewerPi` callers: review-step-run ×2, nested-reviewer-guard test, fake-async guard (must stay real-async — it returns `new Promise`, unchanged) | Confirmed | text search |
| `runStepReview` (review-step-run.mjs, OUT of File Scope) does not forward `usage` from the spawn result into its returns; production verdict rows carry usage only after a follow-up amends that file. Per FR-WORK-06 this task wires the in-scope chain (spawn result → poll emit sites → metric records → rollups) and proves it end-to-end with a fixture; no scope expansion | Documented | STATUS Discoveries |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-19 | Step 0 preflight | SP-878 API + SP-837 emit sites confirmed; impact via text search (GitNexus UNKNOWN); runStepReview usage gap documented |
| 2026-11-19 | Step 1–2 implementation | `--mode json` + SP-878 parse in spawnReviewerPi (human tails via message_end text); finite usage copied in buildReviewMetricRecord/recordReviewMetric; poll emit sites forward `reviewResult.usage`; 12-test file incl. `spine metrics show --json` fixture e2e |
| 2026-11-19 | Out-of-scope edit (mechanical) | `tests/batch/review-spawn.test.mjs` (NOT in File Scope): required `--mode json` argv change broke 5 exact-shape/positional assertions; minimal fixture update (`assertReviewerArgShape` spine + inherit-test positions) to keep the required change's own test file green for post-integrate release:check. Documented per FR-WORK-06 |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
