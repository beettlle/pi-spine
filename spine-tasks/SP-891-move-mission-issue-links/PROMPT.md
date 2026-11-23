# Task: SP-891 — Move mission-issue-links to integrations/issues

**Created:** 2026-11-23
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Import path breakage for board-select and sync-on-land.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Partial #387 — Move leaf-pure `mission-issue-links.mjs` from `src/integrations/github/` to `src/integrations/issues/`. Update all imports and tests. No behavior change.

## Dependencies

- **Task:** SP-890

## Context to Read First

- GitHub #387
- `src/integrations/github/mission-issue-links.mjs`
- `src/cli/board-select.mjs` — import
- `src/integrations/github/sync-on-land.mjs` — relative import

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/integrations/issues/mission-issue-links.mjs`
- `src/integrations/github/mission-issue-links.mjs`
- `src/integrations/github/sync-on-land.mjs`
- `src/cli/board-select.mjs`
- `tests/integrations/issues/mission-issue-links.test.mjs`
- `tests/integrations/github/mission-issue-links.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/integrations/issues/mission-issue-links.test.mjs tests/cli/board-select.test.mjs tests/integrations/github/sync-on-land.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-891` |
| fileScopeMustChange | `src/integrations/issues/mission-issue-links.mjs`, `src/cli/board-select.mjs`, `tests/integrations/issues/mission-issue-links.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] List all importers of `mission-issue-links.mjs`
- [ ] Confirm SP-890 landed (`integrations.issues` reader)

### Step 1: Move module + rewire imports

- [ ] Add `src/integrations/issues/mission-issue-links.mjs` (move content)
- [ ] Delete old github path file
- [ ] Update board-select + sync-on-land imports
- [ ] Move/update unit tests under `tests/integrations/issues/`

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand`

### Step 3: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] Module lives under `src/integrations/issues/`
- [ ] No remaining imports of old github mission-issue-links path
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `refactor(SP-891): move mission-issue-links to integrations/issues (#387)`

## Do NOT

- Change parser behavior
- Extract github provider (SP-892)
- Move sync-on-land (SP-893)
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
