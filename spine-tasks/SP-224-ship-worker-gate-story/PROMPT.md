# Task: SP-224 — Worker manual gate execution

**Created:** 2026-06-12
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Execute chosen manual-gate path after SP-241 inventory (implement or document not_supported).
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-224-ship-worker-gate-story/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-13 (phase 2): Execute the decision from SP-241 — either wire `spine_request_gate` for supported manual gate kinds **or** document permanent `not_supported` in worker tool, runbook, and README with operator workaround (`spine gate approve` from host).

## Dependencies

- **Task:** SP-241

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `src/worker-tools/request-gate.mjs`
- `docs/adoption/operator-runbook.md`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-13

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/worker-tools/request-gate.mjs`
- `docs/adoption/operator-runbook.md`
- `README.md`
- `tests/worker-tools/**`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/worker-tools/request-gate.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read SP-241 decision (implement vs document)

### Step 1: Implement or document
> **Plan-review checkpoint**

- [ ] Wire supported manual gate kinds OR document permanent limitation
- [ ] Runbook workaround: `spine gate approve` from host
- [ ] Call `spine_review_step` if code changed

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] README limitation if not_supported
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Worker gate story resolved (implement or documented limitation)
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-224): complete Step N — description`
- `fix(SP-224): description`
- `test(SP-224): description`

## Do NOT

- Re-run gate inventory (SP-241)
- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-12
**Issue:** Original M packet combined inventory spike and execution.
**Resolution:** Inventory/decision moved to SP-241; SP-224 executes chosen path (Size S).
