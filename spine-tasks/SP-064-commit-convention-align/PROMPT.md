# Task: SP-064 — Commit convention alignment

**Created:** 2026-06-03
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Small diff across four files but normative — picks one commit format and updates PRD, worker template, and both worker runners.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 2

## Mission

Eliminate drift between **FR-WORK-03** (`docs/PRD.md`), `templates/agents/worker.md`, `bin/spine-worker-runner.mjs`, and `src/batch/agent-session-worker.mjs`. Pick **one** step-boundary commit convention and apply it everywhere:

- **Option A:** `{taskId} step {n}: {step title}` (current PRD FR-WORK-03)
- **Option B:** `feat(TASK-ID): complete Step N — {step title}` (current worker template + runners)

Document the chosen convention normatively in `docs/PRD.md` FR-WORK-03 and update all three execution surfaces to match.

## Dependencies

- **Task:** SP-063 (worker template review-level ordering should be stable before commit wording finalizes)

## Context to Read First

**Tier 3:**
- `docs/PRD.md` §7.5 FR-WORK-03
- `templates/agents/worker.md` — Git Commit Convention / checkpoint discipline
- `bin/spine-worker-runner.mjs` — inline `feat(${taskIdHint})` hint
- `src/batch/agent-session-worker.mjs` — `buildAgentSessionWorkerPrompt`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/agents/worker.md`
- `bin/spine-worker-runner.mjs`
- `src/batch/agent-session-worker.mjs`
- `docs/PRD.md`

## Steps

### Step 0: Preflight

- [ ] Grep repo for both commit format patterns; list all occurrences in File Scope files
- [ ] Read SP-063 worker template (review ordering references commits)

### Step 1: Choose convention

> **Plan-review checkpoint**

- [ ] Decide Option A or Option B (prefer consistency with create-spine-tasks skill / existing worker template unless PRD rationale favors A)
- [ ] Record decision in STATUS.md Discoveries table

### Step 2: Apply across execution surfaces

> **Code review checkpoint**

- [ ] Update `docs/PRD.md` FR-WORK-03 with chosen format + one example
- [ ] Update `templates/agents/worker.md` checkpoint / Git Commit Convention text
- [ ] Update inline commit hint in `bin/spine-worker-runner.mjs`
- [ ] Update inline commit hint in `src/batch/agent-session-worker.mjs` (`buildAgentSessionWorkerPrompt`)

**Artifacts:**
- All four File Scope files (modified)

### Step 3: Testing & Verification

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Grep confirms no contradictory commit examples remain in File Scope files

## Documentation Requirements

**Must Update:**
- `docs/PRD.md` — FR-WORK-03 normative format

**Check If Affected:**
- `skills/create-spine-tasks/SKILL.md` — only if chosen format differs from skill examples (note in Discoveries; do not expand scope without amendment)

## Completion Criteria

- [ ] Single commit convention documented in PRD and reflected in worker template + both runners
- [ ] No mixed `feat(TASK-ID)` vs `{taskId} step {n}` examples in scoped files
- [ ] Full test suite green

## Git Commit Convention

Use the **chosen** convention for this task’s step commits (meta — document which you picked in Step 1).

## Do NOT

- Refactor runner hints beyond commit string (SP-067 dedup)
- Change review level behavior (SP-063)

## Amendments

_(Workers only.)_
