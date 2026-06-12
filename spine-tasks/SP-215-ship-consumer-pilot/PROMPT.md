# Task: SP-215 — Tier-3 consumer pilot report

**Created:** 2026-06-12
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** External repo dogfood with filled evidence report; mostly docs with operational verification.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-215-ship-consumer-pilot/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-05: Produce filled consumer pilot report (e.g. `docs/adoption/consumer-pilot-report-YYYY-MM-DD.md`) on an **external** consumer repo. Include stub batch, real-pi batch, land loop, recovery path, and journal excerpt.

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
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| artifactsMustExist | `docs/adoption/consumer-pilot-report-*.md` |

## Steps

### Step 0: Preflight

- [ ] Select external consumer repo (not pi-spine dogfood only)
- [ ] Copy template to dated instance

### Step 1: Execute pilot
> **Plan-review checkpoint**


- [ ] Run stub batch on consumer repo
- [ ] Run real-pi batch (or document skip with reason)
- [ ] Complete land loop and at least one recovery path
- [ ] Attach journal excerpt to report

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Sign-off section filled (no placeholders)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Named consumer pilot report committed with evidence
- [ ] FR-REL-07 closed operationally
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-215): complete Step N — description`
- `fix(SP-215): description`
- `test(SP-215): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
