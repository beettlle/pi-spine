# SP-062: Worker execution discipline — Status

**Current Step:** 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read current `templates/agents/worker.md` and PRD FR-WORK-01–08
- [x] Confirm SP-061 coverage sections (if landed) — do not rewrite them here

---

### Step 1: Resume algorithm
**Status:** ✅ Complete

- [x] Add a **Resume algorithm** section: worker reads STATUS.md → finds first incomplete step → continues from there; never restart completed steps
- [x] Document single-session goal (FR-WORK-01): work through all incomplete steps until done or context limit
- [x] Clarify scheduler re-invocation is expected after context-limit exit (FR-WORK-04)

---

### Step 2: Checkbox + File Scope discipline
**Status:** 🟡 In Progress

- [ ] Add **Immediate checkbox rule**: mark each checkbox complete in STATUS.md as soon as the outcome is done — not batched at step end
- [ ] Document **FR-WORK-06 File Scope**: no edits outside `## File Scope` without a PROMPT amendment; cite the section heading workers must obey
- [ ] Keep existing checkpoint / stall / spine tool guidance coherent with new sections

---

### Step 3: Context limit + project customization header
**Status:** ⬜ Not Started

- [ ] Add **FR-WORK-04 context limit** behavior: persist STATUS, commit in-progress work, exit 0; do not create `.DONE` prematurely
- [ ] Add **Project customization header** comment block at top (below YAML frontmatter): projects override via `.spine/agents/worker.md` appended after base template (FR-WORK-08)
- [ ] Explicitly **omit** Taskplane `.DONE` prohibition imports

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Self-review: new sections are scannable, non-contradictory with existing checkpoint discipline

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
