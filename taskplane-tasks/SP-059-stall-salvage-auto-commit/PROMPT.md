# Task: SP-059 — Optional WIP commit on stall (FR-STALL-03B)

**Created:** 2026-06-03
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Opt-in **`lanes.autoCommitOnStall`** (default **false**): after salvage inspection finds scoped dirty files, create one lane-branch commit `wip(<taskId>): stall salvage <iso>`. Journal `lane.salvage_commit`. Refuse on merge-in-progress, conflicts, hook failure. Document §18.5 atomic retry: WIP stays on lane branch.

## Dependencies

- **SP-058**

## Context to Read First

**Tier 3:** `docs/features/stall-recovery-improvements-brief.md` (Feature 3 Phase B), `src/batch/salvage.mjs`, PRD §18.5

## File Scope

- `src/batch/salvage.mjs`
- `src/batch/worker-host.mjs`
- `templates/spine-config.json`
- `tests/batch/salvage-auto-commit.test.mjs` (new)

## Steps

### Step 1: Config + safety gates

> **Plan-review checkpoint**

- [ ] `autoCommitOnStall: false` default; validate in spine-config
- [ ] Refuse when batch phase merging, dirty index conflicts, pre-commit hook fails

### Step 2: WIP commit implementation

- [ ] Single commit scoped paths only; journal `lane.salvage_commit`

### Step 3: Retry semantics + docs

- [ ] Operator runbook note: retry retains WIP on lane branch
- [ ] PRD §18.5 cross-reference

### Step 4: Tests

> **Code review checkpoint**

- [ ] Enabled: dirty scope → commit on lane branch
- [ ] Disabled: no commit (SP-058 behavior only)
- [ ] Full suite green

## Do NOT

- Auto `.DONE`, auto-merge orch, force integrate

## Git Commit Convention

`feat(SP-059): optional WIP commit on stall`

## Amendments

_(Workers only.)_
