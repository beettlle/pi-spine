# Task: SP-893 — Move sync-on-land to integrations/issues

**Created:** 2026-11-23
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Integrate import breakage; leftover `src/integrations/github/` stubs confuse operators.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Partial #387 — Move `sync-on-land.mjs` to `src/integrations/issues/`, rewire `src/batch/integrate.mjs` and tests, remove empty `src/integrations/github/`. Keep journal event names and CLI flag names unchanged (SP-894/SP-895). Provider import stays `./providers/github.mjs`.

## Dependencies

- **Task:** SP-892

## Context to Read First

- GitHub #387
- `src/integrations/github/sync-on-land.mjs`
- `src/batch/integrate.mjs` — `syncIssuesAfterIntegrate` import
- `src/integrations/issues/providers/github.mjs` (post SP-892)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/integrations/issues/sync-on-land.mjs`
- `src/integrations/github/sync-on-land.mjs`
- `src/batch/integrate.mjs`
- `tests/integrations/issues/sync-on-land.test.mjs`
- `tests/integrations/github/sync-on-land.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/integrations/issues/sync-on-land.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-893` |
| fileScopeMustChange | `src/integrations/issues/sync-on-land.mjs`, `src/batch/integrate.mjs`, `tests/integrations/issues/sync-on-land.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm provider extract landed; list sync-on-land importers
- [ ] Note BODY_DIR / comment strings still saying github — OK to leave for SP-896 or rename path only

### Step 1: Move + rewire

- [ ] Move sync-on-land to `src/integrations/issues/`
- [ ] Update integrate import
- [ ] Move tests; delete `src/integrations/github/` and old test dir if empty
- [ ] Optional: rename BODY_DIR `.spine/github-sync` → `.spine/issues-sync` (same task if touch is local)

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

- [ ] Sync module under `src/integrations/issues/`
- [ ] `src/integrations/github/` removed
- [ ] Integrate imports new path
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `refactor(SP-893): move sync-on-land to integrations/issues (#387)`

## Do NOT

- Rename CLI flags (SP-894) or journal event types (SP-895)
- Change sync close/comment semantics
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
