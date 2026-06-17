# Task: SP-263 — SAT-020 coverage flake diagnosis

**Created:** 2026-06-17
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Read-only reproduction and root-cause documentation before code fix.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Reproduce `tests/batch/stall-sat020-integration.test.mjs` flake under `npm run coverage:check`, document root cause and proposed fix in STATUS.md for SP-264. No production code changes.

## Dependencies

- **None**

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

- `tests/batch/stall-sat020-integration.test.mjs`
- `bin/spine-worker-runner.mjs`
- `spine-tasks/SP-257-stabilize-sat020-coverage/PROMPT.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/stall-sat020-integration.test.mjs`
- `tests/fixtures/stall-sat020/**`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/batch/stall-sat020-integration.test.mjs` |
| fileScopeMustNotChange | bin/spine-worker-runner.mjs, src/batch/** |

## Steps

### Step 0: Preflight

- [ ] Run SAT-020 test alone — confirm pass under `npm test`
- [ ] Run `npm run coverage:check` ≥3 times — record pass/fail rate

### Step 1: Root-cause analysis
> **Plan-review checkpoint**

- [ ] Identify timing vs missing-event vs race under coverage instrumentation
- [ ] Document fix approach in STATUS.md Discoveries for SP-264
- [ ] Call `spine_review_step` after step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 3: Documentation & Delivery

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

- `feat(SP-263): complete Step N — description`
- `fix(SP-263): description`
- `test(SP-263): description`

## Do NOT

- Change production stall logic or worker-runner stub in this task
- Implement the fix (SP-264 scope)
---

## Amendments (Added During Execution)
