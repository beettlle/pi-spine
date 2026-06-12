# Task: SP-225 — Phase 25 exit verification

**Created:** 2026-06-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** Phase 25 exit gate before publish.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-225-ship-phase25-exit/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Verify Phase 25 exit criteria (PRD §8): journal structural rebuild, supervisor defer, merger/conflict path, worker gate story. Mark Phase 25 Done; publish remains human-gated in SP-226.

## Dependencies

- **Task:** SP-240
- **Task:** SP-222
- **Task:** SP-223
- **Task:** SP-224

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — §8 Phase 25 exit

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

- [ ] Confirm SP-221–224 Done
- [ ] Read §8 Phase 25 checklist

### Step 1: Exit verification

- [ ] Verify FR-SHIP-10 implemented or v2.3 deferral recorded
- [ ] Verify supervisor defer docs
- [ ] Verify merger/conflict documentation
- [ ] Verify worker gate resolution

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Phase 25 exit in CONTEXT
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Phase 25 exit satisfied
- [ ] SP-226 unblocked (human gate)
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-225): complete Step N — description`
- `fix(SP-225): description`
- `test(SP-225): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
