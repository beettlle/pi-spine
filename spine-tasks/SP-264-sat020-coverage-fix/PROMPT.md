# Task: SP-264 — SAT-020 coverage stabilization fix

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Implement minimal test-harness fix from SP-263 diagnosis.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Apply the fix documented in SP-263 so SAT-020 passes reliably under `npm run coverage:check` (3 consecutive runs). Preserve journal event order: checkpoint_warning → stall_killed → salvage_inspection → task.failed.

## Dependencies

- **Task:** SP-263

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

```bash
spine settings set agents.worker.model cursor/auto
spine settings set agents.reviewer.model google/gemini-3.1-pro-preview
```

## Context to Read First

- `spine-tasks/SP-263-sat020-coverage-diagnosis/STATUS.md`
- `tests/batch/stall-sat020-integration.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/stall-sat020-integration.test.mjs`
- `bin/spine-worker-runner.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | tests/batch/stall-sat020-integration.test.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read SP-263 STATUS Discoveries — confirm fix approach
- [ ] Reproduce flake if still present

### Step 1: Implement stabilization
> **Code review checkpoint**

- [ ] Apply minimal fix (prefer test harness over production stall defaults)
- [ ] Keep SAT-020 stub semantics (2× step_completed, hang without .DONE)
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`
- [ ] Run coverage gate **3 consecutive times**: `npm run coverage:check`

### Step 4: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-264): complete Step N — description`
- `fix(SP-264): description`
- `test(SP-264): description`

## Do NOT

- Disable SAT-020 in CI
- Change production default stall timeouts without PROMPT amendment
- Touch review.mjs (SP-265+ scope)
---

## Amendments (Added During Execution)
