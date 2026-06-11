# Task: SP-129 — Final verdict parsing

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Extends review.mjs; must not break step APPROVE/REVISE.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-129-final-verdict-parse/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Extend parseReviewVerdict and spine review step for --type final with PASS/REVISE/REPLAN verdicts.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-123

## Context to Read First

**Tier 3:**
- `src/batch/review.mjs`
- `docs/PRD-v1.3-upstream-execution-bridge.md §6.4`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review.mjs`
- `bin/spine-review-step.mjs`
- `tests/batch/review.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-123)

### Step 1: parseReviewVerdict accepts PASS/REVISE/REPLAN when reviewTyp


> **Plan-review checkpoint**
- [ ] parseReviewVerdict accepts PASS/REVISE/REPLAN when reviewType is final

### Step 2: Step plan|code still APPROVE/REVISE only

- [ ] Step plan|code still APPROVE/REVISE only

### Step 3: Artifact path .reviews/final-{timestamp}.md

- [ ] Artifact path .reviews/final-{timestamp}.md

### Step 4: Regression: existing step review tests green


> **Code review checkpoint**
- [ ] Regression: existing step review tests green

### Step 5: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 6: Documentation & Delivery

- [ ] Review docs per Documentation Requirements
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-129

## Git Commit Convention

- `feat(SP-129): complete Step N — description`
- `fix(SP-129): description`

## Do NOT

- Break step APPROVE/REVISE behavior (M-UXB-07)

---

## Amendments (Added During Execution)
