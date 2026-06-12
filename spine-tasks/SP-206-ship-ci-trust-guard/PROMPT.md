# Task: SP-206 — CI trust and SAT-020 guard

**Created:** 2026-06-12
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** CI regression guard and SAT-020 contract documentation; touches test + workflow files.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-206-ship-ci-trust-guard/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-01: Keep `npm run typecheck && SPINE_WORKER_STUB=1 npm test` green on `main`. Guard SAT-020 stall replay contract in CI and document the sequence in the operator runbook.

## Dependencies

- **Task:** SP-205

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-01
- `tests/batch/stall-sat020-integration.test.mjs`
- `docs/features/stall-recovery-improvements-brief.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/stall-sat020-integration.test.mjs`
- `.github/workflows/*.yml`
- `docs/adoption/operator-runbook.md`
- `src/batch/heartbeat.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `tests/batch/stall-sat020-integration.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SAT-020 integration test passes locally
- [ ] Review CI workflow test job

### Step 1: CI regression guard
> **Plan-review checkpoint**


- [ ] Ensure stub test suite runs on every PR/push to `main`
- [ ] Add or tighten SAT-020 contract assertion if gaps found
- [ ] No new empty catch blocks or TODO/FIXME in `src/` from this change

### Step 2: Runbook SAT-020 section

- [ ] Document expected journal sequence: checkpoint_warning → stall kill → salvage → task.failed
- [ ] Link to stall-recovery brief and SAT-020 test file

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures
- [ ] Run build: npm run typecheck

### Step 4: Documentation & Delivery

- [ ] Runbook updated
- [ ] Create `.DONE`

## Completion Criteria

- [ ] SAT-020 test green in CI
- [ ] Runbook documents stall replay contract
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-206): complete Step N — description`
- `fix(SP-206): description`
- `test(SP-206): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
