# Task: SP-068 — PRD Appendix C review levels

**Created:** 2026-06-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Adds Appendix C to PRD with review level table from create-spine-tasks skill and fixes FR-REV-05 cross-reference — docs-only.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Add **Appendix C — Review Levels** to `docs/PRD.md` with the review level 0–3 table copied from `skills/create-spine-tasks/SKILL.md` (labels, spine behavior, `spine_review_step` usage). Fix **FR-REV-05** so it references Appendix C instead of the non-existent or stale "Taskplane rubric" wording.

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- `docs/PRD.md` — §7.6 FR-REV-05, appendix structure
- `skills/create-spine-tasks/SKILL.md` — Review Levels table and scoring rubric

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/PRD.md`

## Steps

### Step 0: Preflight

- [ ] Locate FR-REV-05 in PRD; note current Appendix references
- [ ] Copy review level table from create-spine-tasks skill

### Step 1: Add Appendix C

> **Plan-review checkpoint**

- [ ] Add **Appendix C: Review Levels** with:
  - Level 0–3 table (Label, Spine behavior, worker/reviewer actions)
  - Pointer to complexity scoring dimensions (optional short summary from skill)
  - `spine_review_step` / CLI equivalent note
- [ ] Update **FR-REV-05** row: "Review levels 0–3 (see Appendix C)" — remove Taskplane rubric reference

**Artifacts:**
- `docs/PRD.md` (modified)

### Step 2: Testing & Verification

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify internal links / appendix numbering consistent with existing PRD appendices

## Documentation Requirements

**Must Update:**
- `docs/PRD.md` — Appendix C + FR-REV-05

**Check If Affected:**
- None

## Completion Criteria

- [ ] Appendix C present with review level table aligned to create-spine-tasks skill
- [ ] FR-REV-05 references Appendix C
- [ ] Full test suite green

## Git Commit Convention

- **Step completion:** `feat(SP-068): complete Step N — description`
- **Docs:** `docs(SP-068): add Appendix C review levels`

## Do NOT

- Change worker/reviewer templates (SP-062/063/065)
- Duplicate full complexity scoring essay — keep appendix concise

## Amendments

_(Workers only.)_
