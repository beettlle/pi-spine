# Task: SP-616 — Create-spine-tasks DoR lanes

**Created:** 2026-07-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs/skill-only DoR tighten for intended parallel waves; no engine changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #193 — Tighten create-spine-tasks Definition of Ready so intended parallel waves are verified via `spine plan` multi-lane output, false deps are avoided, and shared-doc/hot-file overlaps are called out as lane-collapse risks. Docs/skill only — no engine or planner behavior change.

**Source:** [`docs/PRD-v2.3.2-state-drift-recovery-handoff.md`](../../docs/PRD-v2.3.2-state-drift-recovery-handoff.md) §6 FR-REL232-04

## Dependencies

- **None**

## Context to Read First

- [`skills/create-spine-tasks/SKILL.md`](../../skills/create-spine-tasks/SKILL.md) — Step B, File Scope and parallel batches, DoR checklist
- [`skills/spine-autonomous-operator/SKILL.md`](../../skills/spine-autonomous-operator/SKILL.md) — Phase 1.3 DoR wording
- [`.cursor/rules/spine-task-authoring.mdc`](../../.cursor/rules/spine-task-authoring.mdc) — only if checklist drifts

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/spine-autonomous-operator/SKILL.md`
- `.cursor/rules/spine-task-authoring.mdc`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/SKILL.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Read #193 acceptance checklist
- [ ] Locate Step B / File Scope / DoR sections in create-spine-tasks

### Step 1: DoR + false-deps + shared-doc guidance

- [ ] Add false-deps guidance + parallel counter-example (soften serial-only schema→handlers→tests example)
- [ ] DoR checkbox: when parallelism intended, `spine plan` must show `N lanes in parallel` (or explain serial collapse)
- [ ] Shared-doc / hot-file note under File Scope and parallel batches
- [ ] Align one-line DoR wording in spine-autonomous-operator if needed
- [ ] Optional one-line mirror in spine-task-authoring.mdc only if checklist drifts

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md` — DoR, false deps, shared-doc note

**Check If Affected:**
- `skills/spine-autonomous-operator/SKILL.md`
- `.cursor/rules/spine-task-authoring.mdc`

## Completion Criteria

- [ ] DoR checklist updated in create-spine-tasks
- [ ] Parallel counter-example + false-dep guidance present
- [ ] Shared-doc/hot-file note present
- [ ] No engine/planner behavior change
- [ ] Issue #193 closable after land

## Do NOT

- Change planner/engine packing behavior
- Modify `src/**` or `bin/**`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `docs(SP-616): create-spine-tasks DoR multi-lane checks`
