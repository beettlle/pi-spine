# Task: SP-135 — spine metrics show CLI

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Read-only CLI over JSONL file.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-135-metrics-show-cli/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Implement spine metrics show [--batch ID] [--json] [--last N] and doctor advisory hint.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-134

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

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-134)

### Step 1: Filter by batchId

- [ ] Filter by batchId; human table + JSON output

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
- [ ] Acceptance criteria in handoff doc satisfied for SP-135

## Git Commit Convention

- `feat(SP-135): complete Step N — description`
- `fix(SP-135): description`

## Do NOT



---

## Amendments (Added During Execution)
