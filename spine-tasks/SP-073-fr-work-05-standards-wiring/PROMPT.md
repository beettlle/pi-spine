# Task: SP-073 — Wire FR-WORK-05 standards into worker context

**Created:** 2026-06-03
**Size:** L

## Review Level: 2 (Plan + Code)

**Assessment:** `referenceDocs`, `standards`, and `neverLoad` exist in spine-config but are never injected into worker prompts.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Implement FR-WORK-05 tiered context: inject configured standards/referenceDocs into worker prompts; honor neverLoad; populate init defaults from `.cursor/rules/`.

## Dependencies

- **Task:** SP-081

## File Scope

- `bin/spine-worker-runner.mjs`
- `src/batch/agent-session-worker.mjs`
- `src/config/worker-context.mjs` (new)
- `bin/spine-init.mjs`
- `bin/spine-config.mjs`
- `templates/spine-config.json`
- `templates/agents/worker.md`
- `tests/config/worker-context.test.mjs` (new)

## Steps

### Step 0: Preflight
- [ ] Confirm no runtime consumers today

### Step 1: Worker context builder
> **Plan-review checkpoint**
- [ ] `buildWorkerContext()` with neverLoad + byte cap
- [ ] `spine_review_step` after step

### Step 2: Wire runner + agent session
> **Code review checkpoint**
- [ ] Inject in worker-runner and agent-session-worker
- [ ] Validate config arrays in spine-config.mjs
- [ ] `spine_review_step` after step

### Step 3: Init defaults + worker template
- [ ] spine init populates standards from `.cursor/rules/`

### Step 4: Testing & Verification
- [ ] Unit tests + FULL suite + coverage ≥77%

### Step 5: Documentation & Delivery
- [ ] Document FR-WORK-05 in runbook/PRD

## Git Commit Convention
- `feat(SP-073): complete Step N — description`

## Do NOT
- Inject unbounded rules tree
- Break SPINE_WORKER_STUB=1

---

## Amendments (Added During Execution)
