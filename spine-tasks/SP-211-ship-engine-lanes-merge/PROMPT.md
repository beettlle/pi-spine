# Task: SP-211 — Engine lanes merge-phase and god-file removal

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Final split slice; must meet ≤500 LOC per src/batch/*.mjs file.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-211-ship-engine-lanes-merge/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Extract merge-phase wiring; shrink or replace `engine-lanes.mjs` god file. **No `src/batch/*.mjs` file may exceed 500 lines** after this task (FR-SHIP-02).

## Dependencies

- **Task:** SP-210

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-02
- `spine-tasks/_explore/engine-lanes-split/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/engine-lanes/**`
- `tests/batch/engine*.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/engine-lanes/**` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-210 landed
- [ ] Line-count audit of src/batch/*.mjs

### Step 1: Extract merge wiring and finalize split
> **Plan-review checkpoint**


- [ ] Move merge-phase wiring to module
- [ ] Replace god file with thin re-export or delete if empty
- [ ] Verify no src/batch/*.mjs >500 LOC
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Optional: add CI line-count guard script if not present
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update findings.md Status if superseded
- [ ] Create `.DONE`

## Completion Criteria

- [ ] God file eliminated or ≤500 LOC
- [ ] All batch tests pass
- [ ] FR-SHIP-02 line limit met
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-211): complete Step N — description`
- `fix(SP-211): description`
- `test(SP-211): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
