# Task: SP-057 — Checkpoint warnings (FR-STALL-02)

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

PRD §18.4: file-scope mtime is **warning only** — must not extend stall grace. Today `fileScopeMtimeMs` advances `lastProgressAt`, hiding 55+ min of frozen checkpoints (SAT-020). Implement **FR-STALL-02**: checkpoint vs activity signals, `lane.checkpoint_warning`, default `extendGraceOnFileScope: false`.

## Dependencies

- **SP-056**

## Context to Read First

**Tier 3:** `docs/features/stall-recovery-improvements-brief.md` (Feature 2), `src/batch/heartbeat.mjs`, `src/batch/worker-host.mjs`, `templates/agents/worker.md`

## File Scope

- `src/batch/heartbeat.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/journal.mjs`
- `src/batch/reconcile.mjs` or status diagnose
- `templates/agents/worker.md`, `templates/spine-config.json`
- `tests/batch/checkpoint-warning.test.mjs` (new)

## Steps

### Step 1: Signal model refactor

> **Plan-review checkpoint**

- [ ] Checkpoint vs activity split; grace uses checkpoint only
- [ ] Config: `checkpointWarningMinutes` (10), `extendGraceOnFileScope` (false)

### Step 2: Warning episode + journal

- [ ] `lane.checkpoint_warning` once per episode with dirtyPaths + suggestion

### Step 3: Operator surfaces

- [ ] Diagnose journalHints; worker.md checkpoint discipline

### Step 4: Tests + verification

> **Code review checkpoint**

- [ ] File touch without commit → warning; file-scope does not extend deadline
- [ ] Full suite green

## Do NOT

- Dashboard (SP-060), salvage (SP-058)

## Git Commit Convention

`feat(SP-057): checkpoint warnings for stall activity`

## Amendments

_(Workers only.)_
