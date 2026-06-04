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

> **Amended (SP-094):** Step 3 init seeding of `DEFAULT_SPINE_INIT_STANDARDS` was superseded by SP-093 auto-discovery. Greenfield `spine init` now sets `standards: []`, copies `.spine/rules-profile.json`, and writes committed `.spine/rules-manifest.json`. Workers auto-select rules via `buildWorkerContextAsync` (SP-092). Static `buildWorkerContext` + explicit `config.standards`/`referenceDocs` remain for projects without `.cursor/rules/`. See `docs/design/cursor-rules-discovery.md`.

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

### SP-094 — Auto-discovery supersedes static init defaults (2026-06-04)

SP-073 landed static FR-WORK-05 injection (`buildWorkerContext`, init standards merge). Phase 16 (SP-089–093) replaced init seeding with:

- Committed `.spine/rules-manifest.json` (not gitignored)
- Profile-driven selection including `taskplane-worker-cursor.mdc`
- PROMPT File Scope glob match via micromatch
- `config.standards` append semantics (non-empty values add to auto-selection, do not replace)

SP-073 Step 3 checkbox remains historical; behavior is documented in PRD §7.5.1 and `docs/design/cursor-rules-discovery.md`.
