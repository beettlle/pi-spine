# Task: SP-751 — Matrix index env vars and matrixMaxParallel

**Created:** 2026-09-05
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Env injection for execute + LLM matrix rows; new Contract field `matrixMaxParallel` must cap concurrency without breaking global `lanes.maxParallel`. Touches matrix hot path.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Closes #229 — Inject matrix index environment variables for portable scripts (`SPINE_MATRIX_JOB_ID`, `SPINE_MATRIX_TASK_ID`, `SPINE_MATRIX_TASK_INDEX`, `SPINE_MATRIX_TASK_COUNT`, plus `JOB_COMPLETION_INDEX` alias) into execute shells and LLM row worker contexts. Parse optional Contract `matrixMaxParallel` (positive int) and enforce as a per-matrix concurrency throttle still subject to global `lanes.maxParallel`. Update runbook §2.4.

## Dependencies

- **Task:** SP-747 (serialize shared `docs/adoption/operator-runbook.md` edits after gate synthesis lands; first-class row scheduling #228 already on main)

## Context to Read First

- GitHub #229 — env + throttle brief
- `src/batch/engine-lanes/matrix.mjs` — `runShellInDir` / row env
- `src/batch/engine-lanes/matrix-run.mjs` — row runner / concurrency
- `src/tasks/packet/parse-prompt.mjs` — Contract field parse
- `docs/adoption/operator-runbook.md` §2.4
- Epic #225 (context only)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/matrix.mjs`
- `src/batch/engine-lanes/matrix-run.mjs`
- `src/tasks/packet/parse-prompt.mjs`
- `src/tasks/packet/validate-contract.mjs`
- `tests/batch/matrix-execution.test.mjs`
- `tests/batch/contract-matrix-subst.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/matrix-execution.test.mjs tests/batch/contract-matrix-subst.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/matrix.mjs`, `src/batch/engine-lanes/matrix-run.mjs`, `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Map execute vs LLM row env injection points
- [ ] Map where matrix row concurrency is capped today

### Step 1: Env vars + matrixMaxParallel

- [ ] Inject the five env vars (including `JOB_COMPLETION_INDEX`) for execute and LLM rows
- [ ] Parse `matrixMaxParallel` from Contract; validate positive int
- [ ] Enforce throttle ≤ global `lanes.maxParallel`
- [ ] Tests for env injection and throttle capping

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update runbook §2.4 (env vars + throttle)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — §2.4 matrix env vars and `matrixMaxParallel`

**Check If Affected:**

- `docs/QUICK-REFERENCE.md` — matrix / Contract field cheatsheet if present

## Completion Criteria

- [ ] Env vars present in execute matrix row processes
- [ ] Env vars present for LLM matrix row workers
- [ ] `JOB_COMPLETION_INDEX` alias documented
- [ ] `matrixMaxParallel` parsed and enforced
- [ ] Tests cover env + throttle
- [ ] Runbook §2.4 updated
- [ ] Closes #229
- [ ] `.DONE` created

## Do NOT

- Implement per-row retry/cancel UI (#230 / SP-752)
- Implement `maxFailedIndexes` success policies (#231)
- Change global `lanes.maxParallel` semantics
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-751): matrix env vars and matrixMaxParallel (#229)`
