# Task: SP-083 — Detached resume semantics + failure surfacing

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** `waitForDetachedBatchResume()` returns success when state flips to `running`; detached CLI conflates engine start with resume completion; failures hide in detached-engine.log.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix detached **start/resume** operator contract:

1. `waitForDetachedBatchResume` must not imply resume succeeded on `phase: running` alone — return `status: "engine_started"` or wait for terminal task transition (configurable timeout).
2. On detached failure/timeout, surface last `task.failed` journal payload and tail of `worker-output-*.log` / `detached-engine.log` in CLI output.
3. Timeout message: "Engine may still be running or orphaned — run `spine status --diagnose`" (not generic resume failed).

## Dependencies

- **Task:** SP-082 (orphan detection makes timeout messaging honest)

## File Scope

- `src/batch/detached-start.mjs`
- `src/batch/journal.mjs` (read last task.failed)
- `bin/spine-batch.mjs` (if resume entry points here)
- `tests/batch/detached-start.test.mjs`
- `docs/adoption/operator-runbook.md`

## Steps

### Step 1: Wait semantics

> **Plan-review checkpoint**

- [ ] Change success payload: `{ ok: true, status: "engine_started", phase: "running" }` vs `{ status: "resume_completed" }`
- [ ] Document in CLI output and runbook
- [ ] Optional `--wait-terminal` flag waits for task terminal or batch failed/completed
- [ ] `spine_review_step` after step

### Step 2: Failure surfacing

> **Code review checkpoint**

- [ ] `formatDetachedEngineOutput`: append last journal `task.failed` + 20-line worker log tail
- [ ] Timeout path references diagnose + orphan detection
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Tests for engine_started vs resume_completed
- [ ] Test failure output includes journal excerpt
- [ ] FULL suite + coverage ≥77%

### Step 4: Documentation

- [ ] Runbook detached start/resume section updated

## Git Commit Convention

- `feat(SP-083): complete Step N — description`

## Do NOT

- Block detached mode default (keep detached-by-default)

---

## Amendments (Added During Execution)
