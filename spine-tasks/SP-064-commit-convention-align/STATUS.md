# SP-064: Commit convention alignment — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Grep repo for both commit format patterns; list all occurrences in File Scope files
- [ ] Read SP-063 worker template (review ordering references commits)

---

### Step 1: Choose convention
**Status:** ⬜ Not Started

- [ ] Decide Option A or Option B (prefer consistency with create-spine-tasks skill / existing worker template unless PRD rationale favors A)
- [ ] Record decision in STATUS.md Discoveries table

---

### Step 2: Apply across execution surfaces
**Status:** ⬜ Not Started

- [ ] Update `docs/PRD.md` FR-WORK-03 with chosen format + one example
- [ ] Update `templates/agents/worker.md` checkpoint / Git Commit Convention text
- [ ] Update inline commit hint in `bin/spine-worker-runner.mjs`
- [ ] Update inline commit hint in `src/batch/agent-session-worker.mjs` (`buildAgentSessionWorkerPrompt`)

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Grep confirms no contradictory commit examples remain in File Scope files

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
