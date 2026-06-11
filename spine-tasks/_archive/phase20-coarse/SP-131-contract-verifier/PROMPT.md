# Task: SP-131 — Contract verifier at final review

**Created:** 2026-06-11
**Size:** M

## Review Level: 3 (Full)

**Assessment:** Machine checks in worktree; integrates with final review path.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-131-contract-verifier/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Implement verifyContract machine checks (testCommand, file scope, coverage, artifacts) in lane worktree before final reviewer verdict.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-124
- **Task:** SP-129

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §4.5`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/review.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/contract-verify.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-124, SP-129)

### Step 1: verifyContract(worktreePath, parsedContract, config) per §4.


> **Plan-review checkpoint**
- [ ] verifyContract(worktreePath, parsedContract, config) per §4.5

### Step 2: Reuse coverage parser from existing testing policy

- [ ] Reuse coverage parser from existing testing policy

### Step 3: Attach verifier result to final review input

- [ ] Attach verifier result to final review input

### Step 4: Skip for legacy TP-* and absent Contract


> **Code review checkpoint**
- [ ] Skip for legacy TP-* and absent Contract

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
- [ ] Acceptance criteria in handoff doc satisfied for SP-131

## Git Commit Convention

- `feat(SP-131): complete Step N — description`
- `fix(SP-131): description`

## Do NOT

- Run verifier on step reviews

---

## Amendments (Added During Execution)
