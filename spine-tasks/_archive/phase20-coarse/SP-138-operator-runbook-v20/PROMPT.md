# Task: SP-138 — Operator runbook v2.0 sections

**Created:** 2026-06-11
**Size:** M

## Review Level: 0 (None)

**Assessment:** Docs-only after CLI tasks land.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-138-operator-runbook-v20/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Add operator runbook sections: validate, handoff, needs_replan, Contract mode, metrics show.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-125
- **Task:** SP-128
- **Task:** SP-132

## Context to Read First

**Tier 3:**
- `docs/adoption/operator-runbook.md`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-125, SP-128, SP-132)

### Step 1: spine tasks validate section

- [ ] spine tasks validate section

### Step 2: spine handoff workflow

- [ ] spine handoff workflow

### Step 3: needs_replan diagnosis and retry flow

- [ ] needs_replan diagnosis and retry flow

### Step 4: Contract mode and legacy TP-* guidance

- [ ] Contract mode and legacy TP-* guidance

### Step 5: spine metrics show usage

- [ ] spine metrics show usage

### Step 6: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 7: Documentation & Delivery

- [ ] Update: docs/adoption/operator-runbook.md
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-138

## Git Commit Convention

- `feat(SP-138): complete Step N — description`
- `fix(SP-138): description`

## Do NOT



---

## Amendments (Added During Execution)
