# Task: SP-132 — needs_replan diagnosis

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Diagnosis taxonomy + reconcile precedence extension.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-132-needs-replan-diagnosis/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Add needs_replan to diagnosis taxonomy and reconciliation precedence; operator JSON per handoff §9.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-130

## Context to Read First

**Tier 3:**
- `src/batch/diagnosis.mjs`
- `src/batch/reconcile.mjs`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/reconcile.mjs`
- `tests/compat/final-verdict-reconcile.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-130)

### Step 1: Add needs_replan to DIAGNOSIS_TAXONOMY


> **Plan-review checkpoint**
- [ ] Add needs_replan to DIAGNOSIS_TAXONOMY

### Step 2: Detect exitReason needs_replan and last REPLAN verdict

- [ ] Detect exitReason needs_replan and last REPLAN verdict

### Step 3: Precedence: needs_replan over needs_retry


> **Code review checkpoint**
- [ ] Precedence: needs_replan over needs_retry; blocks needs_merge

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Review docs per Documentation Requirements
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-132

## Git Commit Convention

- `feat(SP-132): complete Step N — description`
- `fix(SP-132): description`

## Do NOT

- Change plain needs_retry for non-replan failures

---

## Amendments (Added During Execution)
