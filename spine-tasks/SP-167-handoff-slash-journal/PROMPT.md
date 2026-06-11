# Task: SP-167 — Handoff slash and journal

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** /spine-handoff, journal event, spine next hint.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-128

## Mission

Wire /spine-handoff slash, handoff.written journal event, spine next handoff path hint.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-148

## Context to Read First

**Tier 3:**
- `extensions/spine/slash-commands.ts`
- `src/batch/journal.mjs`

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

- [ ] Read handoff §11.1 entry for SP-167
- [ ] Dependencies satisfied (SP-148)

### Step 1: /spine-handoff delegates to CLI

- [ ] /spine-handoff delegates to CLI; handoff.written journal event

### Step 2: spine next appends Handoff hint when file exists

- [ ] spine next appends Handoff hint when file exists

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-167

## Git Commit Convention

- `feat(SP-167): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
