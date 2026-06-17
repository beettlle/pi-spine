# Task: SP-257 — Stabilize SAT-020 under coverage instrumentation

**Created:** 2026-06-17
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Timing-sensitive integration test flakes under `coverage:check`; touches test harness and possibly stub timing.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

`tests/batch/stall-sat020-integration.test.mjs` passes under `npm test` but can fail under `npm run coverage:check` (instrumentation slows timing). Make the SAT-020 stall replay contract deterministic so the coverage gate is trustworthy in CI.

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

- `tests/batch/stall-sat020-integration.test.mjs` — SAT-020 replay contract
- `bin/spine-worker-runner.mjs` — `SPINE_WORKER_STUB_SAT020` stub sequence
- `spine-tasks/SP-060-stall-observability-docs/PROMPT.md` — original SAT-020 fixture intent
- `docs/adoption/operator-runbook.md` — stall diagnosis section (link only if behavior changes)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/stall-sat020-integration.test.mjs`
- `bin/spine-worker-runner.mjs`
- `tests/fixtures/stall-sat020/**`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `tests/batch/stall-sat020-integration.test.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/stall-sat020-integration.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Run `npm test -- tests/batch/stall-sat020-integration.test.mjs` — confirm pass
- [ ] Run `npm run coverage:check` — reproduce flake or document pass rate (≥3 runs)
- [ ] Read journal event order asserted: `checkpoint_warning` → `stall_killed` → `salvage_inspection` → `task.failed`

### Step 1: Root-cause and fix plan
> **Plan-review checkpoint**

- [ ] Identify whether flake is timing (stall thresholds), missing event, or race in batch engine under coverage
- [ ] Choose fix: widen test-only timeouts, mock clock, or decouple from wall-clock where safe
- [ ] Document chosen approach in STATUS.md before coding
- [ ] Call `spine_review_step` after step

### Step 2: Implement stabilization
> **Code review checkpoint**

- [ ] Apply minimal fix — prefer test harness/config over production stall logic changes
- [ ] If `spine-worker-runner.mjs` stub timing changes, keep SAT-020 semantics (2× step_completed, file-scope touch, hang without `.DONE`)
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run SAT-020 test alone: `npm test -- tests/batch/stall-sat020-integration.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate **3 consecutive times**: `npm run coverage:check` — all pass
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Add one sentence to operator runbook SAT-020 section if test config changed materially
- [ ] Log flake root cause in STATUS.md Discoveries
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (unless runbook note required in Step 4)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SAT-020 / stall diagnosis

## Completion Criteria

- [ ] `npm run coverage:check` passes reliably (verified 3×)
- [ ] SAT-020 journal event order unchanged
- [ ] No weakening of stall kill or `.DONE` fail-closed semantics

## Git Commit Convention

- `feat(SP-257): complete Step N — description`
- `fix(SP-257): description`
- `test(SP-257): description`

## Do NOT

- Disable SAT-020 test in CI
- Change production default stall timeouts without explicit PROMPT amendment
- Touch review.mjs strangler work (SP-258/SP-259)

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-17
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to SP-263, SP-264.

