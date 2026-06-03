# Task: TP-045 — Taskplane / spine mutual exclusion guard

**Created:** 2026-06-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Prevent split-brain when **Taskplane `/orch`** and **spine batches** run concurrently (PRD §22.1 mutual exclusion).

Deliverables:
1. **Detection** — preflight + doctor detect active Taskplane batch (`.pi/batch-state.json` with taskplane-shaped phase) while spine batch also active, or spine active when taskplane batch running
2. **Fail loud** — preflight returns non-zero with `suggestedCommand` (dismiss/complete the other system first)
3. **Tests** — `tests/doctor/taskplane-coexistence.test.mjs`
4. **Docs** — bootstrap-checklist + doctor section note

**Success:** Starting a spine batch while Taskplane batch is active fails preflight with clear message.

## Dependencies

- **TP-043** — adoption docs reference coexistence

## Context to Read First

**Tier 3:** `src/batch/preflight.mjs`, `bin/spine.mjs` doctor, PRD mutual exclusion

## File Scope

- `src/batch/preflight.mjs` or `src/doctor/coexistence.mjs` (new)
- `bin/spine.mjs`
- `tests/doctor/taskplane-coexistence.test.mjs` (new)
- `docs/adoption/bootstrap-checklist.md` (if exists from TP-044, else note in readiness doc)

## Steps

### Step 1: Detection logic

> **Plan-review checkpoint**

- [ ] Identify Taskplane vs spine batch-state markers
- [ ] Shared helper used by preflight and doctor

### Step 2: Wire preflight + doctor

- [ ] Non-zero exit + JSON/CLI message with alternatives

### Step 3: Tests + docs

- [ ] Unit tests with fixture batch-state files
- [ ] Document in adoption docs

### Step 4: Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] Coexistence blocked at preflight
- [ ] Tests pass

## Do NOT

- Do not auto-dismiss Taskplane batches
- Do not modify Taskplane extension

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-043): local install doctor check`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
