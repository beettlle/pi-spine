# Task: SP-233 — Consumer pilot real-pi and recovery

**Created:** 2026-06-12
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Real-pi batch, land loop, recovery path, and pilot report sign-off on external consumer repo.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-233-consumer-pilot-real-pi/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-05 (phase 2): On the external consumer repo selected in SP-215, run real-pi batch (or document skip with reason), complete land loop and at least one recovery path, attach journal excerpt, and fill sign-off section in the dated pilot report.

## Dependencies

- **Task:** SP-215

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/CONTEXT.md`
- `docs/adoption/consumer-pilot-report-*.md`
- `docs/adoption/operator-runbook.md`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-05

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/consumer-pilot-report-*.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| artifactsMustExist | docs/adoption/consumer-pilot-report-*.md |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-215 report skeleton exists
- [ ] Confirm external consumer repo still valid

### Step 1: Real-pi pilot
> **Plan-review checkpoint**

- [ ] Run real-pi batch on consumer repo (or document skip with reason)
- [ ] Complete land loop and at least one recovery path
- [ ] Attach journal excerpt to report
- [ ] Fill sign-off section (no placeholders)

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% (when code changed)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Filled consumer pilot report committed with real-pi/recovery evidence
- [ ] FR-REL-07 closed operationally
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-233): complete Step N — description`
- `fix(SP-233): description`
- `test(SP-233): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
