# Task: SP-629 — Load gate postures from spine-config

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Config merge with fail-closed defaults.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 1

## Mission

Partial #123 — Load/merge `gates.postures` (or equivalent) from spine-config: per-category posture, `alwaysBreakOn` tags, `autoApproveAfterN`. Invalid/missing config fails closed to DEFAULT_POSTURES (locked integrate).

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-07

## Dependencies

- **Task:** SP-627 (defaults)

## Context to Read First

- `src/config/spine-config-load.mjs` (or current config load path)
- `src/batch/gate-posture-defaults.mjs`
- GitHub [#123](https://github.com/beettlle/pi-spine/issues/123)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/gate-posture-config.mjs`
- `src/config/spine-config-load.mjs`
- `tests/config/gate-posture-config.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/config/gate-posture-config.test.mjs` |
| fileScopeMustChange | `src/config/gate-posture-config.mjs`, `tests/config/gate-posture-config.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Config load + merge

- [ ] Parse optional postures section; merge over defaults
- [ ] Unknown categories/postures fail closed to locked
- [ ] Unit tests for missing, valid, and invalid config

### Step 2: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified (if any)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- templates/spine-config.json — only if documenting new keys without breaking schema

## Completion Criteria

- [ ] Config helper ready for stamp/wire tasks

## Do NOT

- Wire auto-approve (SP-632)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-629): load gate postures from spine-config`

