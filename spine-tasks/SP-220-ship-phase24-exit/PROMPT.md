# Task: SP-220 — Phase 24 exit verification

**Created:** 2026-06-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** Phase 24 exit gate checklist.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-220-ship-phase24-exit/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Verify Phase 24 exit criteria (PRD §8): consumer pilot, extension coverage, dashboard parity, journal export, agentSession decision. Mark Phase 24 Done in CONTEXT.

## Dependencies

- **Task:** SP-215
- **Task:** SP-216
- **Task:** SP-217
- **Task:** SP-218
- **Task:** SP-219

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — §8 Phase 24 exit

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-215–219 Done
- [ ] Read §8 Phase 24 checklist

### Step 1: Exit verification

- [ ] Verify filled consumer pilot report exists
- [ ] Confirm slash-commands.ts ≥70% coverage
- [ ] Smoke default dashboard view
- [ ] Confirm journal export test + docs
- [ ] Confirm agentSession decision recorded

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Phase 24 exit in CONTEXT
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Phase 24 exit criteria satisfied
- [ ] Phase 25 unblocked
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-220): complete Step N — description`
- `fix(SP-220): description`
- `test(SP-220): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
