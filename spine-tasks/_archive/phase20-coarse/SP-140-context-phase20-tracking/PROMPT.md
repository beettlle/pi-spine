# Task: SP-140 — CONTEXT Phase 20 tracking

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Meta tracking task — updates CONTEXT and dependencies graph.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Canonical Task Folder

```
spine-tasks/SP-140-context-phase20-tracking/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Finalize spine-tasks/CONTEXT.md Phase 20 section, dependencies.json edges, Next Task ID SP-141.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-123
- **Task:** SP-124
- **Task:** SP-125
- **Task:** SP-126
- **Task:** SP-127
- **Task:** SP-128
- **Task:** SP-129
- **Task:** SP-130
- **Task:** SP-131
- **Task:** SP-132
- **Task:** SP-133
- **Task:** SP-134
- **Task:** SP-135
- **Task:** SP-136
- **Task:** SP-137
- **Task:** SP-138
- **Task:** SP-139

## Context to Read First

**Tier 3:**
- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-123, SP-124, SP-125, SP-126, SP-127, SP-128, SP-129, SP-130, SP-131, SP-132, SP-133, SP-134, SP-135, SP-136, SP-137, SP-138, SP-139)

### Step 1: Add Phase 20 wave table and exit criteria

- [ ] Add Phase 20 wave table and exit criteria

### Step 2: Set Next Task ID to SP-141

- [ ] Set Next Task ID to SP-141

### Step 3: Verify spine plan SP-123 respects dependency graph

- [ ] Verify spine plan SP-123 respects dependency graph

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Update: spine-tasks/CONTEXT.md
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- `spine-tasks/CONTEXT.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-140

## Git Commit Convention

- `feat(SP-140): complete Step N — description`
- `fix(SP-140): description`

## Do NOT

- Implement feature code in this task

---

## Amendments (Added During Execution)
