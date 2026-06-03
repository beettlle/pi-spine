# Task: SP-063 — Worker review levels

**Created:** 2026-06-03
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Adds review-level table and L2+ ordering to the worker template — behavioral contract change but still a single file.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Add a **Review Levels 0–3** reference table to `templates/agents/worker.md`, aligned with `skills/create-spine-tasks/SKILL.md`. For Level 2+, document the strict order of operations: commit step work → call `spine_review_step` with `type=code` (and plan review when required) → mark the step complete in STATUS **only after** reviewer **APPROVE**. Workers must not tick step-complete checkboxes while a review is pending REVISE.

## Dependencies

- **Task:** SP-062 (worker execution discipline sections must exist first)

## Context to Read First

**Tier 3:**
- `templates/agents/worker.md`
- `skills/create-spine-tasks/SKILL.md` — Review Levels table and `spine_review_step` guidance
- `docs/PRD.md` §7.6 (FR-REV, FR-WORK-07)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/agents/worker.md`

## Steps

### Step 0: Preflight

- [ ] Read SP-062 worker template output (resume, checkbox, checkpoint sections)
- [ ] Read create-spine-tasks review level rubric

### Step 1: Review level table

> **Plan-review checkpoint**

- [ ] Add inline **Review Levels 0–3** table (labels + when to call `spine_review_step`)
- [ ] Match level names and behavior to `skills/create-spine-tasks/SKILL.md` (None / Plan Only / Plan + Code / Full)
- [ ] Note FR-WORK-07: worker calls `spine_review_step` when review level > 0

**Artifacts:**
- `templates/agents/worker.md` (modified)

### Step 2: L2+ order of operations

> **Code review checkpoint**

- [ ] Document **Level 2+ sequence** per step: (1) finish step work, (2) update STATUS checkboxes for outcomes, (3) commit, (4) `spine_review_step` (`type=plan` and/or `type=code` per PROMPT), (5) on APPROVE only — mark step **Status** complete in STATUS.md
- [ ] On REVISE: address feedback, re-commit if needed, re-request review; do not advance to next step
- [ ] On review spawn failure: stop with non-zero exit (fail closed, FR-REV-06)

**Artifacts:**
- `templates/agents/worker.md` (modified)

### Step 3: Testing & Verification

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Cross-check table against create-spine-tasks skill — no contradictory level definitions

## Documentation Requirements

**Must Update:**
- `templates/agents/worker.md`

**Check If Affected:**
- None (PRD Appendix C is SP-068; commit format is SP-064)

## Completion Criteria

- [ ] Review level 0–3 table present and aligned with create-spine-tasks skill
- [ ] L2+ commit → review → APPROVE → mark step complete ordering documented
- [ ] Full test suite green

## Git Commit Convention

- **Step completion:** `feat(SP-063): complete Step N — description`

## Do NOT

- Change commit message format (SP-064)
- Edit reviewer template (SP-065)
- Edit runner inline hints (SP-067)

## Amendments

_(Workers only.)_
