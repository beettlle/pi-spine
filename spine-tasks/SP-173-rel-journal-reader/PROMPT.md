# Task: SP-173 — Journal timeline reader

**Created:** 2026-06-11
**Size:** S

## Review Level: 3 (Full)

**Assessment:** Phase 22 reliability epic (SP-REL-003).
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Create readJournalTimeline() filtering task/batch lifecycle events.

**Source:** [docs/PRD-v2.1-reliability-handoff.md](../../docs/PRD-v2.1-reliability-handoff.md)

## Dependencies

- **Task:** SP-172

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.1-reliability-handoff.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/journal-rebuild.mjs`
- `tests/batch/journal-rebuild.test.mjs`

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

- [ ] Read handoff entry for SP-173
- [ ] Dependencies satisfied

### Step 1: Implement

- [ ] Deliver mission scope for SP-173

### Step 2: Testing & Verification

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% on in-scope changed code
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update docs per scope
- [ ] Create `.DONE` when complete

## Completion Criteria

- [ ] All steps complete
- [ ] Handoff §4 acceptance for SP-173

## Git Commit Convention

- `feat(SP-173): complete Step N — description`

## Do NOT

- Expand scope beyond File Scope without replan
