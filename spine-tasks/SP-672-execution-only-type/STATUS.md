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
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] No active batch running

---

### Step 1: Parse `Type: execute` frontmatter
**Status:** ⬜ Not Started

- [ ] Locate frontmatter parser in `parse-prompt.mjs`
- [ ] Add `Type` key with default `llm`
- [ ] Expose `type` in parsed task object
- [ ] Validate execute tasks have runnable command

---

### Step 2: Add execution-only runner path
**Status:** ⬜ Not Started

- [ ] Add shell-command runner path
- [ ] Reuse worktree/env/heartbeat
- [ ] Match stdout/stderr/exit capture

---

### Step 3: Wire engine to choose runner
**Status:** ⬜ Not Started

- [ ] Branch on `task.type === 'execute'` in engine
- [ ] Preserve lane isolation and maxParallel
- [ ] Keep `.DONE` and contract verify flow

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `npm run typecheck` passes
- [ ] Execution-only test fixture runs
- [ ] Existing LLM task behavior unchanged
- [ ] Targeted test command passes
- [ ] All failures fixed

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] STATUS.md updated
- [ ] Notes captured for SP-673 runbook update

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
| 2026-07-19 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
