# Task: SP-232 — Pin agent models from spine-config (worker pin)

**Created:** 2026-06-12
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Worker runner passes `--model` from spine-config when not `inherit`.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **Option A (worker spawn only):** when `.spine/spine-config.json` `agents.worker.model` is set and not `inherit`, `bin/spine-worker-runner.mjs` passes `pi --model <value>`. Template defaults, runbook, and optional doctor warning are **SP-238**.

**Incidents (2026-06-12 stress test):** Real-pi batches inherited LM Studio via `inherit`; workers never received `--model`.

## Dependencies

- **Task:** SP-212
- **Task:** SP-088

## Context to Read First

**Tier 3:**
- `bin/spine-worker-runner.mjs` — pi spawn args (~lines 208–242)
- `src/batch/review.mjs` — verify reviewer already passes `--model`
- `tests/config/settings-fields.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests stub pi spawn)

## File Scope

- `bin/spine-worker-runner.mjs`
- `tests/batch/worker-model-pin.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `bin/spine-worker-runner.mjs`, `tests/batch/worker-model-pin.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm reviewer path already passes `--model` when not `inherit`
- [ ] Reproduce worker runner omits `--model` today (grep / small unit test)

### Step 1: Worker model pin
> **Plan-review checkpoint**

- [ ] Pass `--model` from `agents.worker.model` when not `inherit` / empty
- [ ] Pass `--thinking` from `agents.worker.thinking` when pi CLI supports it and value is set

### Step 2: Testing & Verification

- [ ] Unit test: worker runner argv includes `--model cursor/auto` when configured
- [ ] Unit test: `inherit` omits `--model`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Real-pi worker spawn respects spine-config model pin without requiring pi TUI model change
- [ ] Tests green; coverage ≥77%

## Git Commit Convention

- `feat(SP-232): complete Step N — description`

## Do NOT

- Update template/runbook/doctor (SP-238)
- Remove `inherit` as a valid setting
- Hard-code LM Studio URLs in spine

---

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-12
**Issue:** Original S packet had 3 impl steps and 7 file-scope entries (effectively M).
**Resolution:** Template/runbook/doctor moved to SP-238; SP-232 is worker argv + tests only.
