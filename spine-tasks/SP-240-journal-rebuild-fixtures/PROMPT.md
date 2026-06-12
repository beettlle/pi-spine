# Task: SP-240 — Journal rebuild incident fixtures

**Created:** 2026-06-12
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Incident fixture regression tests and Babysitter limitations documentation.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-240-journal-rebuild-fixtures/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-10 (phase 2): Add incident fixture regression tests for structural journal rebuild and document known limitations vs Babysitter full replay.

## Dependencies

- **Task:** SP-221

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `src/batch/journal-rebuild.mjs`
- `tests/fixtures/incidents/**`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-10

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/journal-rebuild*.test.mjs`
- `tests/fixtures/incidents/**`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Review SP-221 structural rebuild implementation
- [ ] Select incident fixtures to cover

### Step 1: Fixtures and docs
> **Plan-review checkpoint**

- [ ] Add incident fixture regression tests
- [ ] Document limitations vs Babysitter replay in runbook
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% (when code changed)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Incident fixture tests pass
- [ ] Limitations documented
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-240): complete Step N — description`
- `fix(SP-240): description`
- `test(SP-240): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
