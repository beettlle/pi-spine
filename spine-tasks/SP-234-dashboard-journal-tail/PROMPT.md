# Task: SP-234 — Dashboard journal tail panel

**Created:** 2026-06-12
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Journal tail or deep-link affordance on default dashboard view.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-234-dashboard-journal-tail/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-07 (phase 2): Add journal tail panel or deep link to default dashboard view (gate/diagnosis completed in SP-217).

## Dependencies

- **Task:** SP-217

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/CONTEXT.md`
- `src/dashboard/public/dashboard.js`
- `src/dashboard/public/index.html`
- `src/dashboard/snapshot.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/public/dashboard.js`
- `src/dashboard/public/index.html`
- `tests/dashboard/**`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/dashboard/public/dashboard.js |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Review snapshot journalTail fields
- [ ] Confirm SP-217 gate/diagnosis panels landed

### Step 1: Journal tail panel
> **Plan-review checkpoint**

- [ ] Add journal tail list or deep link to default view
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% (when code changed)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Default dashboard shows journal tail or link
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-234): complete Step N — description`
- `fix(SP-234): description`
- `test(SP-234): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
