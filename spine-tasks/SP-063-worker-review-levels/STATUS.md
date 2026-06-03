# SP-063: Worker review levels — Status

**Current Step:** 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read SP-062 worker template output (resume, checkbox, checkpoint sections)
- [x] Read create-spine-tasks review level rubric

---

### Step 1: Review level table
**Status:** 🟡 In Progress

- [x] Add inline **Review Levels 0–3** table (labels + when to call `spine_review_step`)
- [x] Match level names and behavior to `skills/create-spine-tasks/SKILL.md` (None / Plan Only / Plan + Code / Full)
- [x] Note FR-WORK-07: worker calls `spine_review_step` when review level > 0

---

### Step 2: L2+ order of operations
**Status:** 🟡 In Progress

- [x] Document **Level 2+ sequence** per step: (1) finish step work, (2) update STATUS checkboxes for outcomes, (3) commit, (4) `spine_review_step` (`type=plan` and/or `type=code` per PROMPT), (5) on APPROVE only — mark step **Status** complete in STATUS.md
- [x] On REVISE: address feedback, re-commit if needed, re-request review; do not advance to next step
- [x] On review spawn failure: stop with non-zero exit (fail closed, FR-REV-06)

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Cross-check table against create-spine-tasks skill — no contradictory level definitions

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
| 2026-06-03 | Step 0 preflight | SP-062 sections confirmed; rubric read from create-spine-tasks skill |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
