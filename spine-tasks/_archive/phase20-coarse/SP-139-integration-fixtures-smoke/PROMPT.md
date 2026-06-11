# Task: SP-139 — Integration fixtures + adoption smoke

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** E2E fixtures tying Phase 20 together.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-139-integration-fixtures-smoke/
├── PROMPT.md
├── STATUS.md
└── .DONE
```

## Mission

Extend adoption fixtures and smoke script: validate before batch, REPLAN → needs_replan integration path.

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-126
- **Task:** SP-132
- **Task:** SP-135

## Context to Read First

**Tier 3:**
- `scripts/adoption-smoke.sh`
- `tests/adoption/`
## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `test/fixtures/taskplane/FX-*`
- `scripts/adoption-smoke.sh`
- `tests/adoption/**`

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
- [ ] Dependencies satisfied (SP-126, SP-132, SP-135)

### Step 1: FX fixtures for contract validate and final REPLAN


> **Plan-review checkpoint**
- [ ] FX fixtures for contract validate and final REPLAN

### Step 2: adoption-smoke: spine tasks validate before batch

- [ ] adoption-smoke: spine tasks validate before batch

### Step 3: Integration test: REPLAN → needs_replan diagnosis


> **Code review checkpoint**
- [ ] Integration test: REPLAN → needs_replan diagnosis

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Review docs per Documentation Requirements
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/bootstrap-checklist.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff doc satisfied for SP-139

## Git Commit Convention

- `feat(SP-139): complete Step N — description`
- `fix(SP-139): description`

## Do NOT



---

## Amendments (Added During Execution)
