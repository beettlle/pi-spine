# Task: SP-222 — Supervisor defer documentation

**Created:** 2026-06-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** FR-SHIP-11 docs-only defer; runbook + README.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-222-ship-supervisor-defer/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-11: Document explicit defer — supervisor mail and autonomous monitor agent remain out of v2.2. Operators use `spine status --diagnose`, dashboard diagnosis banner, and runbook recovery paths.

## Dependencies

- **Task:** SP-220

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-11
- `docs/adoption/operator-runbook.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `README.md`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read FR-SHIP-11 design decision (default lower scope)

### Step 1: Document defer

- [ ] Runbook § supervisor deferred; primary monitor surfaces listed
- [ ] README honest limits section
- [ ] Note optional stretch task out of v2.2 scope

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Supervisor defer documented in runbook + README
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-222): complete Step N — description`
- `fix(SP-222): description`
- `test(SP-222): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
