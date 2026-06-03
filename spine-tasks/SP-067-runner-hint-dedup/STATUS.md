# SP-067: Runner hint deduplication — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Diff inline hints in both runners; list duplicated vs worker.md-only content
- [ ] Read SP-064 chosen commit format

---

### Step 1: Design shared prompt module
**Status:** ⬜ Not Started

- [ ] Choose approach: (A) `worker-prompt.mjs` exports `buildWorkerTailPrompt({ taskFolder, worktreePath, donePath, reviewLevel })` or (B) minimal one-liner runner deferring to `@worker.md` + PROMPT only
- [ ] Document what stays in runner (paths, `@PROMPT.md`, `@.spine/agents/worker.md` append) vs shared module

---

### Step 2: Implement deduplication
**Status:** ⬜ Not Started

- [ ] Create `src/batch/worker-prompt.mjs` (if approach A) with single source for tools hint, review hint, commit hint, `.DONE` guidance
- [ ] Update `bin/spine-worker-runner.mjs` to use shared builder
- [ ] Update `src/batch/agent-session-worker.mjs` `buildAgentSessionWorkerPrompt` to use shared builder
- [ ] Remove duplicated paragraphs that now live only in `templates/agents/worker.md`

---

### Step 3: Tests + verification
**Status:** ⬜ Not Started

- [ ] Add `tests/batch/worker-prompt.test.mjs` covering commit hint format, review level > 0 hint, done path reference (optional but preferred)
- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Grep: no stale duplicate long-form checkpoint text in runners

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
| 2026-06-03 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
