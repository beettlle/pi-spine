# Task: TP-020 — Review tool + fail-closed worker (Phase 4)

**Created:** 2026-06-01
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Introduces cross-model review spawn and fail-closed behavior when review level > 0. Touches worker runner, reviewer agent contract, journal.
**Score:** 6/8

## Mission

Implement **FR-REV** review pipeline with **fail-closed** spawn failures (FR-REV-06, GAP-REV-01):

1. **`spine_review_step`** — spawn reviewer (`pi -p` or subprocess) with `agents.reviewer.md`; parse structured verdict `APPROVE` | `REVISE` (JSON).
2. **Artifacts** — write `{taskFolder}/.reviews/{step}-{timestamp}.md` (FR-REV-04).
3. **Worker integration** — when PROMPT review level > 0, invoke review after step boundaries; on REVISE, worker addresses feedback; on spawn failure → **stop worker** (exit non-zero), journal `review.failed`.
4. **Journal** — `review.started`, `review.completed`, `review.failed` events.
5. **Tests** — stub reviewer success/failure; fail-closed when spawn fails at level > 0.

**Out of scope:** integrate gate (TP-021), post-mortem (TP-022), dashboard.

**Success:** Fail-closed test proves worker stops when review spawn fails; **110+** tests; wave 12.

## Dependencies

- **TP-019** — multi-lane engine on `main`

## Context to Read First

- `docs/PRD.md` — §7.6 FR-REV, Appendix C review levels
- `templates/agents/reviewer.md`, `bin/spine-worker-runner.mjs`, `src/batch/worker-host.mjs`
- `docs/compatibility/taskplane-gap-list.md` — GAP-REV-01

## File Scope

- `src/batch/review.mjs` (new)
- `bin/spine-review-step.mjs` (new)
- `bin/spine-worker-runner.mjs`, `src/batch/worker-host.mjs`, `src/batch/journal.mjs`
- `templates/agents/reviewer.md`, `.spine/agents/reviewer.md`
- `tests/batch/review.test.mjs` (new)
- `README.md`

## Steps

### Step 0: Preflight
- [ ] FR-REV-06; GAP-REV-01; `spine preflight` clean

### Step 1: Review spawn + verdict parsing
> **Plan-review checkpoint** — verdict JSON schema
- [ ] `runStepReview()`; artifact paths; stub mode for tests

### Step 2: Worker fail-closed integration
- [ ] Hook in worker-host or runner when review level > 0
- [ ] Journal events; worker stops on spawn failure

### Step 3: Docs + verification
- [ ] README; CONTEXT; `npm test`

## Completion Criteria

- [ ] Review spawn failure at level > 0 stops worker; journal `review.failed`
- [ ] Tests pass (**110+**)

## Git Commit Convention

- `feat(TP-020): complete Step N — description`

## Do NOT

- Gate FSM (TP-021); post-mortem (TP-022)

---

## Amendments (Added During Execution)
