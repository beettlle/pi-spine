# Task: SP-223 — Merger conflict UX spike

**Created:** 2026-06-12
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Spike or runbook for manual conflict resolution during integrate.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-223-ship-merger-spike/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-12: Spike or runbook section for manual conflict resolution during `spine integrate` when merge conflicts occur. Document Taskplane merger-agent as explicit non-goal unless spike proves minimal UX insufficient.

## Dependencies

- **Task:** SP-220

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/adoption/operator-runbook.md`
- `src/batch/integrate.mjs`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-12

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `docs/design/**`
- `src/batch/integrate.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Reproduce or review integrate conflict scenarios
- [ ] Read Taskplane merger-agent gap notes

### Step 1: Spike or runbook
> **Plan-review checkpoint**


- [ ] Document operator workflow for merge conflicts during integrate
- [ ] If spike: minimal UX improvement or explicit defer with rationale
- [ ] State merger-agent non-goal for v2.2

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Conflict resolution path documented or spike complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-223): complete Step N — description`
- `fix(SP-223): description`
- `test(SP-223): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
