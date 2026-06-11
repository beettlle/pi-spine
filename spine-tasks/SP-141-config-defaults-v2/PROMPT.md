# Task: SP-141 — Config defaults v2

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Template and init defaults for review, handoff, metrics sections only.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-123a

## Mission

Add review, handoff, and metrics blocks to spine-config.json template and spine init scaffold with merge defaults on load.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-122

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §11.1`
- `templates/spine-config.json`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/spine-config.json`
- `bin/spine-init.mjs`
- `src/config/*.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-141
- [ ] Dependencies satisfied (SP-122)

### Step 1: Add review, handoff, metrics sections per handoff §6.2 

- [ ] Add review, handoff, metrics sections per handoff §6.2 (no contract yet)

### Step 2: Merge defaults on config load for repos missing new key

- [ ] Merge defaults on config load for repos missing new keys

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-141

## Git Commit Convention

- `feat(SP-141): complete Step N — description`

## Do NOT

- Add contract.mode yet (SP-142)
- Implement CLI behavior

---

## Amendments (Added During Execution)
