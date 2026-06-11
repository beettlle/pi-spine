# Task: SP-170 — CONTEXT Phase 20b tracking

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Meta: CONTEXT.md Phase 20b table and Next Task ID SP-171.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

**Replaces:** SP-140

## Mission

Finalize spine-tasks/CONTEXT.md Phase 20b section, verify dependencies.json graph, set Next Task ID SP-171.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-165
- **Task:** SP-163
- **Task:** SP-162
- **Task:** SP-168
- **Task:** SP-167
- **Task:** SP-166
- **Task:** SP-161
- **Task:** SP-160

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

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | see File Scope |
| fileScopeMustNotChange | — |
| minLineCoverage | 77 |
| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-170
- [ ] Dependencies satisfied (SP-165, SP-163, SP-162, SP-168, SP-167, SP-166, SP-161, SP-160)

### Step 1: Add Phase 20b wave table with all SP-141–169 rows and e

- [ ] Add Phase 20b wave table with all SP-141–169 rows and exit criteria

### Step 2: Set Next Task ID SP-171

- [ ] Set Next Task ID SP-171; verify spine plan pending respects graph

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-170

## Git Commit Convention

- `feat(SP-170): complete Step N — description`

## Do NOT

- Implement feature code

---

## Amendments (Added During Execution)
