# SP-672: Execution-only task type in PROMPT frontmatter — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Completed

- [x] Required files and paths exist
- [x] No active batch running

---

### Step 1: Parse `Type: execute` frontmatter
**Status:** ✅ Completed

- [x] Locate frontmatter parser in `parse-prompt.mjs`
- [x] Add `Type` key with default `llm`
- [x] Expose `type` in parsed task object
- [x] Validate execute tasks have runnable command

---

### Step 2: Add execution-only runner path
**Status:** ✅ Completed

- [x] Add shell-command runner path
- [x] Reuse worktree/env/heartbeat
- [x] Match stdout/stderr/exit capture

---

### Step 3: Wire engine to choose runner
**Status:** ✅ Completed

- [x] Branch on `task.type === 'execute'` in engine
- [x] Preserve lane isolation and maxParallel
- [x] Keep `.DONE` and contract verify flow

---

### Step 4: Testing & Verification
**Status:** ✅ Completed

- [x] `npm run typecheck` passes
- [x] Execution-only test fixture runs
- [x] Existing LLM task behavior unchanged
- [x] Targeted test command passes
- [x] All failures fixed

---

### Step 5: Documentation & Delivery
**Status:** ✅ Completed

- [x] STATUS.md updated
- [x] Notes captured for SP-673 runbook update

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `runCommand` isn't fully supported in fallback parser object causing typecheck failure | Updated `parseContract` JSDoc and `worker-host.mjs` fallback struct | `worker-host.mjs` |
| `startBatch` test fails due to worker environment detection | Used stripped `SPINE_IS_WORKER` inside the execution-only unit test | `tests/batch/execution-only.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-07-19 | Step 1 Completed | Added `type` parsing and `runCommand` to Contract fields |
| 2026-07-19 | Step 2, 3, 4 Completed | Wired `spawnExecutionOnlyHandle`, executed tests |
| 2026-07-19 | Step 5 Completed | Documented runbook behavior |

---

## Blockers

*None*

---

## Notes

**For SP-673 Runbook Update:**
- When `Type: execute` is present, the engine bypasses the LLM worker.
- It executes `runCommand` (or `testCommand` if `runCommand` is missing) via `/bin/sh -c` inside the lane worktree.
- If the command succeeds (exit 0), the engine automatically touches `.DONE` for it.
- If it exits non-zero, hangs, or crashes, it fails the task normally.
- Max parallel lanes, environment isolation, and contract verification checks all apply to execution-only tasks.
