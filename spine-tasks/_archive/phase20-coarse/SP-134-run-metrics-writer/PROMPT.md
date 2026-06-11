# Task: SP-134 — run-metrics.jsonl writer

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Append-only persistence; no secrets in records.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 0

## Canonical Task Folder

```
spine-tasks/SP-134-run-metrics-writer/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Append task and batch metric lines to .spine/run-metrics.jsonl on terminal outcomes per handoff §6.5.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-130

## Context to Read First

**Tier 3:**
- `src/batch/lifecycle.mjs`
- `src/batch/engine-lanes.mjs`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/metrics.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/lifecycle.mjs`
- `tests/batch/run-metrics.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-130)

### Step 1: appendTaskMetric on completed/failed/skipped


> **Plan-review checkpoint**
- [ ] appendTaskMetric on completed/failed/skipped

### Step 2: appendBatchMetric on batch terminal

- [ ] appendBatchMetric on batch terminal

### Step 3: Include finalVerdict, contractOk, finalAttempts

- [ ] Include finalVerdict, contractOk, finalAttempts

### Step 4: Respect metrics.enabled


> **Code review checkpoint**
- [ ] Respect metrics.enabled; no prompt text or secrets

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
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-134

## Git Commit Convention

- `feat(SP-134): complete Step N — description`
- `fix(SP-134): description`

## Do NOT

- Log prompt text or env secrets

---

## Amendments (Added During Execution)
