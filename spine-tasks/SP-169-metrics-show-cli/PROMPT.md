# Task: SP-169 — metrics show CLI

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** spine metrics show and doctor advisory.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-135

## Mission

Implement spine metrics show [--batch ID] [--json] [--last N] and doctor metrics advisory.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-159

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §6.5`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine.mjs`
- `bin/spine-doctor.mjs`
- `tests/batch/run-metrics.test.mjs`

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

- [ ] Read handoff §11.1 entry for SP-169
- [ ] Dependencies satisfied (SP-159)

### Step 1: spine metrics show with batch filter and human table ou

- [ ] spine metrics show with batch filter and human table output

### Step 2: Doctor advisory when metrics file exists

- [ ] Doctor advisory when metrics file exists

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-169

## Git Commit Convention

- `feat(SP-169): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
