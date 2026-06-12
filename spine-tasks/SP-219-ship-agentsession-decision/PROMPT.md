# Task: SP-219 — agentSession promotion decision

**Created:** 2026-06-12
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Dogfood sign-off or explicit defer; touches worker backend config and docs.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-219-ship-agentsession-decision/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-09: Complete agent-session dogfood report with land-loop sign-off **or** record explicit decision that subprocess `pi -p` remains default. Doctor/preflight reflects chosen default.

## Dependencies

- **Task:** SP-214

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/compatibility/agent-session-dogfood-report.md`
- `src/config/worker-backend.mjs`
- `src/batch/agent-session-worker.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/compatibility/agent-session-dogfood-report.md`
- `src/config/worker-backend.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `docs/compatibility/agent-session-dogfood-report.md` |

## Steps

### Step 0: Preflight

- [ ] Read SP-181–183 prior dogfood work
- [ ] Run doctor/preflight for agentSession signals

### Step 1: Decision and wiring
> **Plan-review checkpoint**


- [ ] Complete dogfood report with land-loop evidence or defer rationale
- [ ] Update runbook default backend guidance
- [ ] Ensure doctor/preflight matches decision

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] agentSession decision recorded in dogfood report + runbook
- [ ] Doctor reflects default
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-219): complete Step N — description`
- `fix(SP-219): description`
- `test(SP-219): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
