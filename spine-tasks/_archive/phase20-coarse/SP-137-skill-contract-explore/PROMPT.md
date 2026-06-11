# Task: SP-137 — create-spine-tasks Contract + explore

**Created:** 2026-06-11
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Skill and template updates for authors.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-137-skill-contract-explore/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Update create-spine-tasks skill with Step 0 explore and ## Contract authoring guidance; add contract-template.md.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-124

## Context to Read First

**Tier 3:**
- `skills/create-spine-tasks/SKILL.md`
- `docs/PRD-v2.0-implementation-handoff.md §4`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`
- `skills/create-spine-tasks/references/explore-template.md`
- `skills/create-spine-tasks/references/contract-template.md`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-124)

### Step 1: Step 0 Explore when-to-skip guidance

- [ ] Step 0 Explore when-to-skip guidance

### Step 2: Add Contract section to prompt-template

- [ ] Add Contract section to prompt-template

### Step 3: Create contract-template.md with examples

- [ ] Create contract-template.md with examples

### Step 4: Launch sequence includes spine tasks validate pending

- [ ] Launch sequence includes spine tasks validate pending

### Step 5: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 6: Documentation & Delivery

- [ ] Update: skills/create-spine-tasks/references/contract-template.md
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/references/contract-template.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-137

## Git Commit Convention

- `feat(SP-137): complete Step N — description`
- `fix(SP-137): description`

## Do NOT



---

## Amendments (Added During Execution)
