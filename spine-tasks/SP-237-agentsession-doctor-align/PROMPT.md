# Task: SP-237 — agentSession doctor and preflight alignment

**Created:** 2026-06-12
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Doctor/preflight signals match agentSession decision from SP-219.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-237-agentsession-doctor-align/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-09 (phase 2): Ensure doctor/preflight reflects the agentSession default documented in SP-219 (promote agentSession or defer to subprocess `pi -p`).

## Dependencies

- **Task:** SP-219

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/CONTEXT.md`
- `src/config/worker-backend.mjs`
- `bin/spine-doctor.mjs`
- `bin/spine-preflight.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/worker-backend.mjs`
- `bin/spine-doctor.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/config/worker-backend.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read SP-219 decision in dogfood report
- [ ] Run doctor/preflight baseline

### Step 1: Doctor alignment
> **Plan-review checkpoint**

- [ ] Update worker-backend config or doctor checks to match decision
- [ ] Verify preflight messaging matches runbook
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% (when code changed)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Doctor reflects agentSession default
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-237): complete Step N — description`
- `fix(SP-237): description`
- `test(SP-237): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
