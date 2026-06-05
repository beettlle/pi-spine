# Task: SP-113 — Strangler split resume-multi.mjs

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** 898-line god module — highest churn reliability surface post Phase 17.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Apply SP-074 strangler pattern to `resume-multi.mjs`: extract validate module, lane-run module, share merge helpers with engine-lanes. Target ≤350 LOC per file, zero behavior change.

**Source:** SP-106 audit Finding #3 (HIGH).

## Dependencies

- **None**

## File Scope

- `src/batch/resume-multi.mjs`
- `src/batch/resume-multi-validate.mjs` (new)
- `src/batch/resume-multi-lanes.mjs` (new)
- `tests/batch/resume-multi-sequential.test.mjs`
- `tests/batch/resume-multi.test.mjs`

## Steps

### Step 1: Extract validate
- [ ] Move validation/worktree repair to resume-multi-validate.mjs
- [ ] Call `spine_review_step` (plan)

### Step 2: Extract lane run + merge
- [ ] Lane queue/spawn to resume-multi-lanes.mjs
- [ ] Re-export from resume-multi.mjs
- [ ] Call `spine_review_step` (code)

### Step 3: Testing & Verification
- [ ] All resume-multi tests pass unchanged
- [ ] FULL suite + coverage gate

## Completion Criteria
- [ ] resume-multi.mjs ≤400 LOC
- [ ] No regression in resume-multi-sequential tests

## Git Commit Convention
- `refactor(SP-113): split resume-multi into validate and lanes modules`

## Do NOT
- Change resume semantics or journal events

---

## Amendments (Added During Execution)
