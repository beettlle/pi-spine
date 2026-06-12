# Task: SP-209 — Engine lanes queue and provisioning

**Created:** 2026-06-12
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Serial strangler slice; lane queue wiring.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-209-ship-engine-lanes-queue/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Extract lane queue and provisioning from `engine-lanes.mjs` into dedicated module. Behavior parity required.

## Dependencies

- **Task:** SP-208

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/_explore/engine-lanes-split/findings.md`
- `src/batch/engine-lanes/**`

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

- [ ] Confirm SP-208 schedule module landed
- [ ] Read findings queue/provisioning boundary

### Step 1: Extract queue module
> **Plan-review checkpoint**


- [ ] Move lane queue and provisioning logic
- [ ] Preserve imports/exports; no behavior change
- [ ] Call `spine_review_step` after this step

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Queue/provisioning in focused module
- [ ] Tests green
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-209): complete Step N — description`
- `fix(SP-209): description`
- `test(SP-209): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
