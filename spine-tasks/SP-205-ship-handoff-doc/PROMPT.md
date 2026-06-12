# Task: SP-205 — Ship readiness handoff doc

**Created:** 2026-06-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only PRD land and cross-links; no application code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-205-ship-handoff-doc/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Land [docs/PRD-v2.2-ship-readiness-handoff.md](../../docs/PRD-v2.2-ship-readiness-handoff.md) on `main` with cross-links from CONTEXT, README feature summary, and adoption docs. Establishes Phase 23–26 (SP-SHIP) as the active epic.

## Dependencies

- **Task:** SP-204

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md`
- `spine-tasks/CONTEXT.md`
- `docs/PRD-v2.1-reliability-handoff.md` — predecessor pattern

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/PRD-v2.2-ship-readiness-handoff.md`
- `spine-tasks/CONTEXT.md`
- `README.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-204 Done on `main`
- [ ] Read PRD §6–7 task table and wave order

### Step 1: Cross-link PRD

- [ ] Ensure PRD committed with Appendix links (PRD.md, v2.1 handoff, runbook, release checklist)
- [ ] Update CONTEXT Phase 23–26 section to reference this PRD as authoritative spec
- [ ] Add README one-line pointer to ship readiness epic

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Verify cross-links resolve
- [ ] Create `.DONE`

## Completion Criteria

- [ ] PRD v2.2 on `main` with working cross-links
- [ ] CONTEXT Phase 23–26 section references PRD
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-205): complete Step N — description`
- `fix(SP-205): description`
- `test(SP-205): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
