# Task: SP-217 — Dashboard parity default view

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Dashboard UX; gate status, diagnosis headline, journal tail on default view.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-217-ship-dashboard-parity/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-07: Default dashboard view shows integrate gate status (when applicable), reconciliation headline/suggestedCommand, and journal tail or link — without requiring `--diagnose`.

## Dependencies

- **Task:** SP-214

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `src/dashboard/snapshot.mjs`
- `src/dashboard/public/**`
- `docs/adoption/operator-runbook.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/public/**`
- `tests/dashboard/**`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/dashboard/snapshot.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Compare default view vs Taskplane parity gaps
- [ ] Read reconcile/diagnosis snapshot fields

### Step 1: Dashboard panels
> **Plan-review checkpoint**


- [ ] Add gate status affordance to default view
- [ ] Show reconciliation headline and suggestedCommand
- [ ] Add journal tail or deep link
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Runbook land-loop visibility note
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Default dashboard shows gate + diagnosis + journal affordance
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-217): complete Step N — description`
- `fix(SP-217): description`
- `test(SP-217): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
