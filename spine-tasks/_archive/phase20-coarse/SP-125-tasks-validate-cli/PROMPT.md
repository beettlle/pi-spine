# Task: SP-125 — spine tasks validate CLI

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** New CLI exposing existing validation; planner scope reuse.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-125-tasks-validate-cli/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Implement spine tasks validate <scope> with --json and --warnings-only. Reuse planner scope resolution and formatPromptValidationFailures.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-124

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §6.4, §7.1`
- `src/planner/index.mjs`
- `src/tasks/packet/validate-prompt.mjs`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-tasks.mjs`
- `bin/spine.mjs`
- `tests/tasks/validate-cli.test.mjs`
- `test/fixtures/taskplane/FX-invalid-no-testing/**`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-124)

### Step 1: Create bin/spine-tasks.mjs with scope resolution (same as sp


> **Plan-review checkpoint**
- [ ] Create bin/spine-tasks.mjs with scope resolution (same as spine plan)

### Step 2: Human + JSON output per TasksValidateResult schema

- [ ] Human + JSON output per TasksValidateResult schema

### Step 3: Exit codes 0/1/2

- [ ] Exit codes 0/1/2; --warnings-only for non-blocking checks

### Step 4: Wire spine help tasks subcommand


> **Code review checkpoint**
- [ ] Wire spine help tasks subcommand

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
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-125

## Git Commit Convention

- `feat(SP-125): complete Step N — description`
- `fix(SP-125): description`

## Do NOT

- Duplicate validatePrompt schema
- Mutate batch state

---

## Amendments (Added During Execution)
