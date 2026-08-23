# SP-714: Validate and uniquify batch IDs — Status

**Current Step:** Step 5: Documentation & Delivery
**Status:** Complete (pending .DONE)
**Last Updated:** 2026-08-23
**Review Level:** 1
**Review Counter:** 1
**Iteration:** 1
**Size:** S

---

## Step 1: validateBatchId helper

**Status:** Complete

- [x] Add batch-id.mjs with validateBatchId
- [x] Reject traversal and invalid chars
- [x] Backward-compatible pattern

## Step 2: generateBatchId uniquify

**Status:** Complete

- [x] Random suffix + collision loop

## Step 3: Wire CLI validation

**Status:** Complete

- [x] journal-follow and other --batch paths

## Step 4: Testing & Verification

**Status:** Complete

- [x] Run contract testCommand

## Step 5: Documentation & Delivery

**Status:** Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| 2026-08-23 | 1 | plan | skipped (engine-owned, SP-195) |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-22 | Task staged | PROMPT.md and STATUS.md created for v2.15.0 release |
| 2026-08-23 | Steps 1-3 | batch-id.mjs helper, uniquified generateBatchId, CLI validation wired; commit 281954e8 |
| 2026-08-23 | Step 4 | Contract testCommand passes: typecheck clean, 11/11 tests pass |

## Notes

- Plan (Level 1): allowlist `BATCH_ID_PATTERN` in new `src/batch/batch-id.mjs`; `validateBatchId` throws with clear reason. `generateBatchId` moves to batch-id.mjs, gains `-{hex4}` suffix + runtime-dir collision loop (optional projectRoot); state.mjs re-exports it. Wire validation in `resolveFollowBatchId` (covers journal-follow and lane-logs) with clean error return in `runJournalFollow`/`runLaneLogs`.

## Discoveries

| Date | Finding | Action |
|------|---------|--------|
| 2026-08-23 | `src/batch/engine.mjs` and `src/cli/lane-logs.mjs` are outside declared File Scope but logically required: engine passes `projectRoot` into `generateBatchId` for the collision loop; lane-logs shares `resolveFollowBatchId` and needed the same error-return handling. | Minimal one-block edits; noted here per worker rule |
| 2026-08-23 | Pre-existing failures on base commit (35c53a1a): 3x `batch-start-wave.test.mjs` dry-run tests, 5x across `batch-start-superseded-guard`/`sequence-resume`. Identical pass/fail counts with and without this change. | No action; not caused by SP-714 |
| 2026-08-23 | `docs/adoption/operator-runbook.md` uses generic `<batchId>` placeholders only; the timestamp format is not documented, and the suffixed form is copy-paste compatible. | No doc update needed |
| 2026-08-23 | `spine journal replay/export` and `spine handoff --batch` paths still lack `--batch` validation (out of File Scope). | Tech-debt candidate for a follow-up task |
