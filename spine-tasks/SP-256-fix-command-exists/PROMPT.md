# Task: SP-256 — Fix commandExists pi availability check

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Real bug in fail-closed pi detection; small blast radius but touches worker and review spawn paths.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

`commandExists()` in `src/batch/review.mjs` and `src/batch/worker-host.mjs` always returns `true` because it ignores `which` exit status. Extract the correct implementation from `bin/get-version.mjs` into a shared module and use it everywhere pi availability is checked.

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

- `bin/get-version.mjs` — correct `commandExists` implementation
- `src/batch/review.mjs` — broken `commandExists` (~line 399)
- `src/batch/worker-host.mjs` — broken `commandExists` (~line 4)
- `.cursor/rules/critical-rules-quick-reference.mdc` — false compilation / test claims

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/util/command-exists.mjs`
- `src/batch/review.mjs`
- `src/batch/worker-host.mjs`
- `bin/get-version.mjs`
- `tests/util/command-exists.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/util/command-exists.mjs`, `src/batch/review.mjs`, `src/batch/worker-host.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/util/command-exists.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce bug: `commandExists("nonexistent-cmd-xyz")` returns `true` in review/worker-host paths today
- [ ] Confirm `bin/get-version.mjs` checks `result.status === 0`

### Step 1: Shared commandExists module
> **Plan-review checkpoint**

- [ ] Add `src/util/command-exists.mjs` with `export function commandExists(cmd)` checking `which` exit status
- [ ] Preserve `SPINE_REVIEW_TEST_NO_PI=1` behavior in review path (reviewer spawn skips pi when set)
- [ ] Update `review.mjs` and `worker-host.mjs` to import shared helper (remove local copies)
- [ ] Re-export from `bin/get-version.mjs` via import (no duplicate logic)
- [ ] Call `spine_review_step` after step

### Step 2: Tests
> **Code review checkpoint**

- [ ] Add `tests/util/command-exists.test.mjs` — missing command returns `false`, `node`/`git` returns `true`
- [ ] Add regression test that review spawn path respects missing `pi` when env allows
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Note fix in STATUS.md Discoveries if any call sites were missed
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if doctor/review pi checks are documented

## Completion Criteria

- [ ] All `commandExists` call sites use shared module with correct exit-status check
- [ ] Tests prove missing commands return `false`
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-256): complete Step N — description`
- `fix(SP-256): description`
- `test(SP-256): description`

## Do NOT

- Refactor unrelated review.mjs logic (SP-258/SP-259)
- Change stall or SAT-020 behavior (SP-257)
- Skip `spine_review_step` at Level 2 checkpoints

---

## Amendments (Added During Execution)
