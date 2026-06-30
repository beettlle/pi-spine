# SP-350: Worktree cleanup on complete/dismiss — Status

**Current Step:** Step 1 — Implementation
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 1
**Size:** S
**Split from:** SP-335

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-28 | Task staged | Split from SP-335 for issue #26 |
| 2026-06-30 | Step 0 preflight | Read issue #26 + SP-335; wire `removeLaneWorktrees` into `completeBatch`/`dismissBatch` behind `lanes.cleanupWorktreesOnComplete` (default true); journal `batch.worktrees_cleaned` |

---

## Notes (Plan — Review Level 1)

- Add `cleanupBatchLaneWorktrees` helper in `lifecycle.mjs` (config gate, `maxLaneNumber` from `lanes`, journal event).
- Default `lanes.cleanupWorktreesOnComplete: true` in `defaults.mjs`.
- Regression test provisions a lane worktree, completes/dismisses batch, asserts removal + journal.
