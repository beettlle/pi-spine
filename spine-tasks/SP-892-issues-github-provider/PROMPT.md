# Task: SP-892 — Extract issues providers/github.mjs

**Created:** 2026-11-23
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Extract breaks sync soft-fail / timeout behavior if spawn options drift.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Partial #387 — Add `src/integrations/issues/providers/github.mjs` holding the `gh` CLI runner (spawn, timeout, stdout/stderr shape) extracted from `sync-on-land.mjs`. Keep sync behavior identical; default provider remains github.

## Dependencies

- **Task:** SP-891

## Context to Read First

- GitHub #387
- `src/integrations/github/sync-on-land.mjs` — `defaultRunGh`, `GH_CALL_TIMEOUT_MS`
- `src/integrations/issues/mission-issue-links.mjs` (post SP-891)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/integrations/issues/providers/github.mjs`
- `src/integrations/github/sync-on-land.mjs`
- `tests/integrations/issues/providers-github.test.mjs`
- `tests/integrations/github/sync-on-land.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/integrations/issues/providers-github.test.mjs tests/integrations/github/sync-on-land.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-892` |
| fileScopeMustChange | `src/integrations/issues/providers/github.mjs`, `tests/integrations/issues/providers-github.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Identify `defaultRunGh` / timeout / result typedef to extract
- [ ] Confirm SP-891 mission-issue-links path

### Step 1: Extract provider

- [ ] Create `providers/github.mjs` with gh runner export
- [ ] sync-on-land imports provider; remove inlined spawn helper
- [ ] Preserve timeout and soft-fail contract

### Step 2: Testing & Verification

- [ ] Provider unit test (stub spawn)
- [ ] Existing sync-on-land tests still green
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

- [ ] `providers/github.mjs` exists and is used by sync-on-land
- [ ] No behavior change in sync soft-fail paths
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `refactor(SP-892): extract issues github provider runner (#387)`

## Do NOT

- Move sync-on-land path yet (SP-893)
- Implement non-github providers
- Rename journal events or CLI flags
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-11-23 prelanded:** `src/integrations/github/sync-on-land.mjs` already changed on main (SP-890/SP-891); removed from `fileScopeMustChange`. Worker may still edit it to import the extracted provider.
