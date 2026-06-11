# Task: SP-148 — Handoff render and CLI

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Markdown renderer, --json, redaction, golden snapshot test.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

**Replaces:** SP-127b

## Mission

Render handoff.md per §7.4 section order; spine handoff CLI with --json; secret redaction; golden test.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-147

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §7.4`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/cli/handoff.mjs`
- `bin/spine.mjs`
- `tests/cli/spine-handoff.test.mjs`
- `tests/fixtures/handoff-golden.md`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-148
- [ ] Dependencies satisfied (SP-147)

### Step 1: Markdown renderer with normative section order


> **Plan-review checkpoint**
- [ ] Markdown renderer with normative section order; write .spine/handoff.md

### Step 2: --json output


> **Code review checkpoint**
- [ ] --json output; redact *_KEY, *_TOKEN, *SECRET*; golden snapshot test

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
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-148

## Git Commit Convention

- `feat(SP-148): complete Step N — description`

## Do NOT

- Include worker log bodies

---

## Amendments (Added During Execution)
