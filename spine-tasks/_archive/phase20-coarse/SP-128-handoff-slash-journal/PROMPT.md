# Task: SP-128 — Handoff slash + journal + next hint

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Wiring only after SP-127 core module exists.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-128-handoff-slash-journal/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Wire /spine-handoff slash, journal handoff.written event, and spine next handoff path hint.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-127

## Context to Read First

**Tier 3:**
- `src/cli/handoff.mjs`
- `extensions/spine/slash-commands.ts`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `extensions/spine/slash-commands.ts`
- `src/batch/journal.mjs`
- `bin/spine-cli/batch.mjs`
- `tests/cli/spine-handoff.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-127)

### Step 1: /spine-handoff delegates to spine handoff CLI

- [ ] /spine-handoff delegates to spine handoff CLI

### Step 2: Append handoff.written journal event when batch active

- [ ] Append handoff.written journal event when batch active

### Step 3: spine next appends Handoff hint when file exists

- [ ] spine next appends Handoff hint when file exists

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
- [ ] Acceptance criteria in handoff doc satisfied for SP-128

## Git Commit Convention

- `feat(SP-128): complete Step N — description`
- `fix(SP-128): description`

## Do NOT



---

## Amendments (Added During Execution)
