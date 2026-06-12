# Task: SP-213 — Operator doc sync

**Created:** 2026-06-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** FR-SHIP-04 doc drift fix; CONTEXT and readiness alignment.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-213-ship-doc-sync/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-04: Sync operator docs — CONTEXT header reflects Phases 0–22b Done; priority backlog marks completed items Done; `real-project-readiness.md` test counts match reality (~765 tests); remove technical debt entries for tasks on `main`.

## Dependencies

- **Task:** SP-205

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-04
- `spine-tasks/CONTEXT.md`
- `docs/adoption/real-project-readiness.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/CONTEXT.md`
- `docs/adoption/real-project-readiness.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Run test count: `SPINE_WORKER_STUB=1 npm test`
- [ ] Inventory stale Staged/Done mismatches in CONTEXT

### Step 1: Refresh docs

- [ ] Update CONTEXT header and priority backlog
- [ ] Align real-project-readiness.md phase status and test counts
- [ ] Remove technical debt entries for landed tasks

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] CONTEXT and readiness docs match main reality
- [ ] No stale Staged entries for Done work
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-213): complete Step N — description`
- `fix(SP-213): description`
- `test(SP-213): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
