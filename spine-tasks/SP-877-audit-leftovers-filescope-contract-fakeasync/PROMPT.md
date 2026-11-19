# Task: SP-877 — Audit leftovers: fileScope fallback, contract.errors, fake-async bin guard

**Created:** 2026-11-19
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Malformed SPINE_TASK_FILE_SCOPE silently falls back; parseContract errors become echo-fail; runSpinePlan is fake-async outside the bin/ guard sweep.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** Three SP-107 leftovers: resolveTaskFileScope ignores bad JSON; worker-host ignores parseContract().errors; runSpinePlan is async with no await and bin/ is outside the fake-async arch guard.

## Mission

Closes #319 — Close the three audit leftovers:

1. **fileScope** — Do not silently ignore malformed `SPINE_TASK_FILE_SCOPE` JSON; fail or validate before prompt use.
2. **contract.errors** — Surface `parseContract().errors` in worker-host instead of converting to a silent failing echo.
3. **fake-async** — Make `runSpinePlan` honestly sync (or truly async) and extend the fake-async arch guard to cover `bin/` (or this symbol).
4. **Tests** — Cover each leftover.

## Dependencies

- **None**

## Context to Read First

- GitHub #319
- `bin/spine-worker-runner.mjs` resolveTaskFileScope
- `src/batch/worker-host.mjs` parseContract path
- `bin/spine-plan.mjs` runSpinePlan
- `tests/arch/fake-async.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `bin/spine-worker-runner.mjs`
- `src/batch/worker-host.mjs`
- `bin/spine-plan.mjs`
- `tests/arch/fake-async.test.mjs`
- `tests/batch/worker-host-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/arch/fake-async.test.mjs tests/batch/worker-host-contract.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-877` |
| fileScopeMustChange | `bin/spine-worker-runner.mjs`, `src/batch/worker-host.mjs`, `bin/spine-plan.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm three leftover sites
- [ ] Read fake-async guard scope

### Step 1: Three leftovers

- [ ] Validate fileScope env JSON
- [ ] Surface contract.errors
- [ ] Fix runSpinePlan + extend guard

### Step 2: Tests

- [ ] Cover each leftover path

### Step 3: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-877-audit-leftovers-filescope-contract-fakeasync/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics / plan-review sections when relevant)

## Completion Criteria

- [ ] Confirm three leftover sites
- [ ] Read fake-async guard scope
- [ ] Validate fileScope env JSON
- [ ] Surface contract.errors
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-877): audit leftovers fileScope contract fake-async (#319)`

## Do NOT

- Broad refactors beyond the three leftovers
- Disable fake-async guard
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
