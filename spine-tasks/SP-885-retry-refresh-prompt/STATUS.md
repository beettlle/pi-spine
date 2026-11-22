# SP-885: Refresh PROMPT.md into lane on batch retry — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm retry does not currently copy PROMPT from base
- [x] Identify lane worktree + task folder paths at retry time

---

### Step 1: Refresh packet on retry
**Status:** ✅ Complete

- [x] Copy base PROMPT into lane task folder
- [x] Preserve lane artifacts correctly
- [x] Journal refresh event
- [x] Update runbook

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [ ] Tests cover refresh
- [ ] Contract testCommand passing

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Must Update docs modified
- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-22 | Step 0 preflight | Confirmed `retryTask` only resets batch state (no packet copy); lane copy resolves as `path.join(state.lanes[laneNumber].worktreePath, taskFolderRel)` where `taskFolderRel = path.relative(projectRoot, state.tasks[].taskFolder)`; `verifyContract` + final review read the **lane** PROMPT (`taskFolderInWorktree`), pre-spawn scope parse reads **base** — refresh of the lane copy closes exactly that gap. GitNexus `impact retryTask` returned UNKNOWN (stale index); text-search confirmed callers: `bin/spine-batch.mjs` CLI + tests only. |
| 2026-11-22 | Step 1 implemented | `refreshTaskPacketFromBase` in `src/batch/engine-lanes/orch-sync.mjs` (best-effort: skips on missing base packet / lane worktree / lane packet; copies PROMPT.md only when content differs; pathspec commit so dirty lane work is untouched); wired into `retryTask` after `task.retry_requested` with journal events `task.packet_refreshed` / `task.packet_refresh_failed`; runbook section "Packet refresh on retry (issue #378)" added under the #85 paragraph. |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #378.
