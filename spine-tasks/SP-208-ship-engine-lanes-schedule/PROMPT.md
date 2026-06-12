# Task: SP-208 — Engine lanes wave/tick schedule

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** First strangler extract from god module; multi-file refactor with behavior parity requirement.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-208-ship-engine-lanes-schedule/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Extract wave/tick scheduling from `src/batch/engine-lanes.mjs` into `src/batch/engine-lanes/schedule.mjs` (or equivalent). No behavior change; all batch integration tests pass.

## Dependencies

- **Task:** SP-207

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/_explore/engine-lanes-split/findings.md`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-02

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/engine-lanes/**`
- `tests/batch/engine*.test.mjs`
- `tests/batch/*lanes*.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/engine-lanes/**` |
| fileScopeMustNotChange | `src/planner/**` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for schedule module boundary
- [ ] Baseline: full test suite green

### Step 1: Extract schedule module
> **Plan-review checkpoint**


- [ ] Move wave/tick scheduling helpers to new module
- [ ] Re-export from engine-lanes entry; preserve public API
- [ ] Run targeted engine tests after extract
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification
> **Code review checkpoint**


- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] All batch integration tests pass without behavior change
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Module header documents responsibility
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Schedule logic in focused module
- [ ] engine-lanes.mjs reduced; tests green
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-208): complete Step N — description`
- `fix(SP-208): description`
- `test(SP-208): description`

## Do NOT

- Extract queue/review/merge in this task — SP-209–211

---

## Amendments (Added During Execution)
