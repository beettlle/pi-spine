# SP-064: Commit convention alignment — Status

**Current Step:** 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Grep repo for both commit format patterns; list all occurrences in File Scope files
- [x] Read SP-063 worker template (review ordering references commits)

**Preflight findings (File Scope):**

| File | Option A (`{taskId} step {n}:`) | Option B (`feat(TASK-ID): complete Step N —`) |
|------|--------------------------------|-----------------------------------------------|
| `docs/PRD.md` FR-WORK-03 | ✓ line 399 | — |
| `templates/agents/worker.md` | — | ✓ lines 83, 99 |
| `bin/spine-worker-runner.mjs` | — | ✓ line 205 (abbreviated `feat(${taskIdHint}): …`) |
| `src/batch/agent-session-worker.mjs` | — | ✓ line 39 (abbreviated `feat(${taskIdHint}): …`) |

SP-063 defers commit format to SP-064; L2+ ordering already uses Option B in worker template.

---

### Step 1: Choose convention
**Status:** ✅ Complete

- [x] Decide Option A or Option B (prefer consistency with create-spine-tasks skill / existing worker template unless PRD rationale favors A)
- [x] Record decision in STATUS.md Discoveries table

**Decision:** **Option B** — `feat({taskId}): complete Step {n} — {step title}`

Rationale: worker template, both runners, create-spine-tasks skill, and all staged task PROMPTs already use Option B; only PRD FR-WORK-03 still documents Option A.

---

### Step 2: Apply across execution surfaces
**Status:** 🟡 In Progress

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
| Chose Option B (`feat(TASK-ID): complete Step N — …`); aligns with worker template, runners, create-spine-tasks skill | Update PRD FR-WORK-03 only; worker template already correct | Step 1 |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-03 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-03 | Step 1 decision | Option B chosen; PRD is sole drift source |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
