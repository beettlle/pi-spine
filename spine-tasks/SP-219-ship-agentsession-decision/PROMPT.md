# Task: SP-219 — agentSession promotion decision (report)

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Dogfood sign-off or explicit defer in report + runbook default backend guidance.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-219-ship-agentsession-decision/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-09 (phase 1): Complete agent-session dogfood report with land-loop sign-off **or** record explicit decision that subprocess `pi -p` remains default. Update runbook default backend guidance. Doctor/preflight alignment is **SP-237**.

## Dependencies

- **Task:** SP-214

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/compatibility/agent-session-dogfood-report.md`
- `docs/adoption/operator-runbook.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/compatibility/agent-session-dogfood-report.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/compatibility/agent-session-dogfood-report.md` |

## Steps

### Step 0: Preflight

- [ ] Read SP-181–183 prior dogfood work

### Step 1: Decision and runbook
> **Plan-review checkpoint**

- [ ] Complete dogfood report with land-loop evidence or defer rationale
- [ ] Update runbook default backend guidance

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] agentSession decision recorded in dogfood report + runbook
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-219): complete Step N — description`
- `fix(SP-219): description`
- `test(SP-219): description`

## Do NOT

- Wire doctor/preflight checks (SP-237)
- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-12
**Issue:** Original M packet bundled report decision and doctor/preflight wiring.
**Resolution:** Doctor/preflight alignment moved to SP-237; SP-219 is report + runbook only (Size S).
