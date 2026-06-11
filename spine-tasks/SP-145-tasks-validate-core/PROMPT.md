# Task: SP-145 — tasks validate CLI core

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Core spine tasks validate with scope resolution and human output.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-125a

## Mission

Create bin/spine-tasks.mjs: scope resolution (same as spine plan), human output, exit codes 0/1/2.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-144

## Context to Read First

**Tier 3:**
- `src/planner/index.mjs`
- `src/tasks/packet/validate-prompt.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-tasks.mjs`
- `bin/spine.mjs`
- `tests/tasks/validate-cli.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-145
- [ ] Dependencies satisfied (SP-144)

### Step 1: Implement spine tasks validate with planner scope resol


> **Plan-review checkpoint**
- [ ] Implement spine tasks validate with planner scope resolution

### Step 2: Human output: Validated N task(s): X passed, Y failed


> **Code review checkpoint**
- [ ] Human output: Validated N task(s): X passed, Y failed; wire spine.mjs router

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 4: Documentation & Delivery

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-145

## Git Commit Convention

- `feat(SP-145): complete Step N — description`

## Do NOT

- Mutate batch state
- Duplicate validatePrompt schema

---

## Amendments (Added During Execution)
