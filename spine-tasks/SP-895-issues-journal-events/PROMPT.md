# Task: SP-895 — Journal events issues.synced / issues.sync_failed

**Created:** 2026-11-23
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Dashboards or operators grepping old event names break; intentional breaking rename.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Partial #387 — Rename journal event types from `github.issue_synced` / `github.issue_sync_failed` to `issues.synced` / `issues.sync_failed`. Update sync-on-land emitters and tests. No silent dual-write of old names.

## Dependencies

- **Task:** SP-894

## Context to Read First

- GitHub #387
- `src/integrations/issues/sync-on-land.mjs` — journal() calls
- `tests/integrations/issues/sync-on-land.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/integrations/issues/sync-on-land.mjs`
- `tests/integrations/issues/sync-on-land.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/integrations/issues/sync-on-land.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-895` |
| fileScopeMustChange | |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Grep for `github.issue_synced` / `github.issue_sync_failed`
- [ ] Confirm SP-894 landed (no concurrent sync-on-land edits)

### Step 1: Rename journal types

- [ ] Emit `issues.synced` / `issues.sync_failed`
- [ ] Update tests; no dual-write of old names

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand`

### Step 3: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (docs packet SP-896)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (SP-896)

## Completion Criteria

- [ ] Only new journal event type strings remain in sync module + tests
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `feat(SP-895): rename issue sync journal events (#387)`

## Do NOT

- Dual-write old event names
- Edit operator docs (SP-896)
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-11-23 prelanded:** `src/integrations/issues/sync-on-land.mjs` and `tests/integrations/issues/sync-on-land.test.mjs` already changed on main (SP-893/SP-894); cleared `fileScopeMustChange` (no non-stale delivery path). Worker must still edit those File Scope paths for the journal rename; Contract `testCommand` enforces the rename.
