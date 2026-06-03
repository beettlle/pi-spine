# Task: TP-050 — createAgentSession worker backend spike (v1.1)

**Created:** 2026-06-02
**Size:** L

## Review Level: 2 (Plan + Code)

**Assessment:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Spike **PRD v1.1** optional execution backend: use pi extension `createAgentSession` for lane workers/reviewers instead of subprocess `pi -p`.

Deliverables:
1. **`docs/adoption/create-agent-session-spike.md`** — feasibility, API surface needed from pi-coding-agent, pros/cons vs subprocess
2. **Feature flag** — `lanes.workerBackend: subprocess | agentSession` (default subprocess)
3. **Minimal implementation** — single-lane happy path behind flag OR documented blocker with issue template
4. **Tests** — mock agent session; no real pi in CI

**Success:** Clear go/no-go for v1.1 with flag scaffold or working prototype for one lane.

## Dependencies

- **TP-048** — subprocess path validated first

## Context to Read First

**Tier 3:** `src/batch/worker-host.mjs`, PRD createAgentSession table, `@earendil-works/pi-coding-agent` types

## File Scope

- `docs/adoption/create-agent-session-spike.md` (new)
- `src/batch/worker-host.mjs`
- `src/config/` — workerBackend setting
- `tests/batch/worker-backend.test.mjs` (new)

## Steps

### Step 1: Research + spike doc

> **Plan-review checkpoint**

- [ ] Read pi extension API for createAgentSession
- [ ] Spike doc with sequence diagram

### Step 2: Config flag + scaffold

- [ ] workerBackend setting in spine-config schema
- [ ] Branch in worker-host.mjs

### Step 3: Prototype or document blockers

> **Code review checkpoint**

- [ ] Happy-path prototype OR explicit blockers + follow-up tasks

### Step 4: Verification

- [ ] Tests with mocks
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] Spike doc complete
- [ ] Flag exists; default unchanged (subprocess)

## Do NOT

- Do not break default subprocess worker path
- Do not require real pi in CI

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-043): local install doctor check`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
