# Task: SP-123 — Config schema v2

**Created:** 2026-06-11
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Config schema extension only; no engine behavior yet.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-123-config-schema-v2/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Extend spine-config.json with v2.0 sections (review, handoff, metrics, contract) and validation defaults. Export defaults for downstream Phase 20 tasks.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-122

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §6.2`
- `templates/spine-config.json`
- `src/config/`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/spine-config.json`
- `src/config/*.mjs`
- `bin/spine-init.mjs`
- `tests/config/contract-mode.test.mjs`
- `docs/adoption/operator-runbook.md`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-122)

### Step 1: Add review, handoff, metrics, contract blocks per handoff §6

- [ ] Add review, handoff, metrics, contract blocks per handoff §6.2

### Step 2: Validate on spine init and config load

- [ ] Validate on spine init and config load; merge defaults for missing keys

### Step 3: Export typed defaults from config module

- [ ] Export typed defaults from config module

### Step 4: Unit tests: defaults, invalid contract.mode rejected, legacy

- [ ] Unit tests: defaults, invalid contract.mode rejected, legacyTaskIdPrefixes

### Step 5: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 6: Documentation & Delivery

- [ ] Update: docs/adoption/operator-runbook.md — config table for new keys
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md — config table for new keys`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-123

## Git Commit Convention

- `feat(SP-123): complete Step N — description`
- `fix(SP-123): description`

## Do NOT

- Implement CLI behavior (downstream tasks)
- Break existing config load

---

## Amendments (Added During Execution)
