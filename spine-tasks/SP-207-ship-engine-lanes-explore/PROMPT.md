# Task: SP-207 — Engine lanes split explore

**Created:** 2026-06-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** Read-only explore artifact before strangler split; no behavior change.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-207-ship-engine-lanes-explore/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-02 prerequisite: Write `spine-tasks/_explore/engine-lanes-split/findings.md` mapping `engine-lanes.mjs` (1,875 LOC) into wave/tick, queue/provisioning, review, and merge modules. Link in CONTEXT.

## Dependencies

- **Task:** SP-205

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-02
- `src/batch/engine-lanes.mjs`
- `spine-tasks/_explore/reliability-epic/findings.md` — prior explore pattern

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/_explore/engine-lanes-split/findings.md`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| artifactsMustExist | `spine-tasks/_explore/engine-lanes-split/findings.md` |

## Steps

### Step 0: Preflight

- [ ] Read engine-lanes.mjs structure (read-only)
- [ ] Review SP-074 strangler precedent

### Step 1: Write findings

- [ ] Summary, codebase areas, risks, suggested file scopes per module
- [ ] Proposed module names under `src/batch/engine-lanes/`
- [ ] Open questions for SP-208–211

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Link explore slug in CONTEXT.md
- [ ] Create `.DONE`

## Completion Criteria

- [ ] findings.md exists with suggested scopes for SP-208–211
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-207): complete Step N — description`
- `fix(SP-207): description`
- `test(SP-207): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
