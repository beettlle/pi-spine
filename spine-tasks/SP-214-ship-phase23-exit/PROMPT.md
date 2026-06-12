# Task: SP-214 — Phase 23 exit verification

**Created:** 2026-06-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** Exit gate checklist; verification only.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-214-ship-phase23-exit/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Verify Phase 23 exit criteria (PRD §8): stub suite green, no src/batch/*.mjs >500 LOC, real-pi CI posture, CONTEXT/readiness aligned. Update CONTEXT Phase 23 table to Done.

## Dependencies

- **Task:** SP-211
- **Task:** SP-212
- **Task:** SP-213

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — §8 Phase 23 exit

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/CONTEXT.md`
- `docs/PRD-v2.2-ship-readiness-handoff.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-211, SP-212, SP-213 Done
- [ ] Read §8 Phase 23 exit checklist

### Step 1: Exit verification

- [ ] Run full stub suite and coverage gate
- [ ] Audit src/batch/*.mjs line counts
- [ ] Verify real-pi workflow + doc sync criteria
- [ ] Check off Phase 23 exit in CONTEXT

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Phase 23 exit criteria marked in CONTEXT
- [ ] Create `.DONE`

## Completion Criteria

- [ ] All Phase 23 exit checkboxes satisfied
- [ ] P1 Phase 24 unblocked
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-214): complete Step N — description`
- `fix(SP-214): description`
- `test(SP-214): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
