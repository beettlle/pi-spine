# Task: SP-215 — Tier-3 consumer pilot report (stub phase)

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** External repo selection, template copy, stub batch, report skeleton only.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-215-ship-consumer-pilot/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-05 (phase 1): Select an external consumer repo, copy the pilot report template to a dated file, run a **stub** batch on that repo, and commit a report skeleton with stub-batch evidence. Real-pi batch, land loop, recovery, and sign-off are **SP-233**.

## Dependencies

- **Task:** SP-214

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/adoption/consumer-pilot-report-template.md`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-05
- `docs/adoption/operator-runbook.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/consumer-pilot-report-*.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| artifactsMustExist | `docs/adoption/consumer-pilot-report-*.md` |

## Steps

### Step 0: Preflight

- [ ] Select external consumer repo (not pi-spine dogfood only)
- [ ] Copy template to dated instance

### Step 1: Stub batch and skeleton
> **Plan-review checkpoint**

- [ ] Run stub batch on consumer repo
- [ ] Fill report skeleton with stub-batch evidence sections

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Report skeleton committed (sign-off may remain placeholder until SP-233)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Named consumer pilot report skeleton committed with stub evidence
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-215): complete Step N — description`
- `fix(SP-215): description`
- `test(SP-215): description`

## Do NOT

- Run real-pi batch (SP-233)
- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-12
**Issue:** Original M packet combined stub + real-pi + recovery in one worker session.
**Resolution:** Split real-pi/recovery/sign-off to SP-233; SP-215 is stub + skeleton only (Size S).
