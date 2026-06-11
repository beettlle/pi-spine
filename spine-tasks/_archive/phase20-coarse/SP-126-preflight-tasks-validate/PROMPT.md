# Task: SP-126 — Preflight tasks-validate + slash

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Thin wiring of SP-125 into preflight and slash.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-126-preflight-tasks-validate/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Add preflight check id tasks-validate for pending scope; register /spine-validate slash command.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-125

## Context to Read First

**Tier 3:**
- `bin/spine-preflight.mjs`
- `extensions/spine/slash-commands.ts`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-preflight.mjs`
- `extensions/spine/slash-commands.ts`
- `tests/spine-preflight.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-125)

### Step 1: Add tasks-validate check using shared validate helper

- [ ] Add tasks-validate check using shared validate helper

### Step 2: suggestedCommand on fail: spine tasks validate pending

- [ ] suggestedCommand on fail: spine tasks validate pending

### Step 3: Register /spine-validate slash delegating to CLI

- [ ] Register /spine-validate slash delegating to CLI

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
- [ ] Acceptance criteria in handoff doc satisfied for SP-126

## Git Commit Convention

- `feat(SP-126): complete Step N — description`
- `fix(SP-126): description`

## Do NOT

- Bury validate errors inside plan check message

---

## Amendments (Added During Execution)
