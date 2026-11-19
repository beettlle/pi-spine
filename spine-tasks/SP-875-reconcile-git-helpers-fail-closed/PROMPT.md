# Task: SP-875 — Reconcile git helpers: surface errors/timeouts; drop hardcoded operator branches

**Created:** 2026-11-19
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Timed-out or failed git probes return false/[] so reconcile treats "git failed" as "no", hiding human_base_diverged and mis-classifying merge state.
**Score:** 5/8 — Blast radius: 3, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** Most helpers in reconcile-classify.mjs catch all errors (including 5s timeouts) and return false/[]. Hardcoded orch/cdelgado-* and replace("*","operator") branch candidates are wrong for other users.

## Mission

Closes #310 — Reconcile git inspection must not fail open, and operator branch candidates must not hardcode a username.

1. **Errors** — When git helpers time out or fail, record a visible inspection error (extend the existing gitInspectionError pattern) instead of silent false/[].
2. **Branch candidates** — Remove hardcoded `orch/cdelgado-*` / fake `operator` replace; use generic orch patterns only.
3. **Tests** — Cover timeout/failure → inspection error; cover candidate list without personal username.
4. **Keep** existing successful-path behavior for diagnosis.

## Dependencies

- **None**

## Context to Read First

- GitHub #310
- `src/batch/reconcile-classify.mjs`
- Existing gitInspectionError paths (branch --merged / countCommitsAhead)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/reconcile-classify.mjs`
- `tests/batch/reconcile-classify.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/reconcile-classify.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-875` |
| fileScopeMustChange | `src/batch/reconcile-classify.mjs`, `tests/batch/reconcile-classify.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] List helpers that swallow errors
- [ ] Locate hardcoded branch candidates

### Step 1: Fail-closed helpers + candidates

- [ ] Surface git failures/timeouts
- [ ] Drop hardcoded username branch candidates

### Step 2: Tests

- [ ] Timeout/failure → inspection error
- [ ] Candidates exclude personal username

### Step 3: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-875-reconcile-git-helpers-fail-closed/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics / plan-review sections when relevant)

## Completion Criteria

- [ ] List helpers that swallow errors
- [ ] Locate hardcoded branch candidates
- [ ] Surface git failures/timeouts
- [ ] Drop hardcoded username branch candidates
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-875): reconcile git helpers fail-closed (#310)`

## Do NOT

- Invent merge state when git fails
- Change gate FSM unrelated to reconcile classification
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
