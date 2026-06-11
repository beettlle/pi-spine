# Task: SP-133 — Agent templates final + contract

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Template-only; extends SP-063/065 patterns.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-133-agent-templates-final-contract/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Update worker and reviewer templates for final verdict and contract verification per handoff §8.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-129
- **Task:** SP-131

## Context to Read First

**Tier 3:**
- `templates/agents/worker.md`
- `templates/agents/reviewer.md`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/agents/worker.md`
- `templates/agents/reviewer.md`
- `tests/agent-template-drift.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-129, SP-131)

### Step 1: Worker: final review sequence before .DONE

- [ ] Worker: final review sequence before .DONE

### Step 2: Reviewer: PASS/REVISE/REPLAN section for --type final

- [ ] Reviewer: PASS/REVISE/REPLAN section for --type final

### Step 3: Extend agent template drift test

- [ ] Extend agent template drift test

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
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-133

## Git Commit Convention

- `feat(SP-133): complete Step N — description`
- `fix(SP-133): description`

## Do NOT

- Change step review enums

---

## Amendments (Added During Execution)
