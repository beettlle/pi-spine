# Task: SP-127 — spine handoff CLI

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** New CLI module reading reconcile + journal; secret redaction required.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-127-handoff-cli/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Implement spine handoff [--batch ID] [--json] writing .spine/handoff.md with normative sections per handoff §7.4.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-123

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §7.4`
- `src/batch/reconcile.mjs`
- `src/batch/journal.mjs`
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

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-123)

### Step 1: Implement handoff data assembly from reconcileBatch and jour


> **Plan-review checkpoint**
- [ ] Implement handoff data assembly from reconcileBatch and journal tail

### Step 2: Markdown renderer with normative section order

- [ ] Markdown renderer with normative section order

### Step 3: --json output with handoffPath

- [ ] --json output with handoffPath

### Step 4: Redact secrets (NFR-UXB-02)


> **Code review checkpoint**
- [ ] Redact secrets (NFR-UXB-02); idle state when no active batch

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
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-127

## Git Commit Convention

- `feat(SP-127): complete Step N — description`
- `fix(SP-127): description`

## Do NOT

- Include API keys, tokens, or worker log bodies

---

## Amendments (Added During Execution)
