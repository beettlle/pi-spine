# Task: SP-890 — Config schema: integrations.issues + provider

**Created:** 2026-11-23
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Fail-closed reject of `integrations.github` breaks existing configs; sync reader must move in lockstep.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #387 — Accept `integrations.issues` with `provider` (default `"github"`) + `syncOnLand`; reject `integrations.github` with a clear `CONFIG_INTEGRATIONS_INVALID` error (no silent alias). Update defaults and the sync config reader so land sync still resolves the flag.

## Dependencies

- **None**

## Context to Read First

- GitHub #387
- `src/config/defaults.mjs` — `INTEGRATIONS_DEFAULTS`
- `src/config/spine-config-schema.mjs` — `validateIntegrationsConfig`
- `src/integrations/github/sync-on-land.mjs` — `resolveGithubSyncOnLandConfig`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/defaults.mjs`
- `src/config/spine-config-schema.mjs`
- `src/integrations/github/sync-on-land.mjs`
- `tests/config/integrations-issues-schema.test.mjs`
- `tests/integrations/github/sync-on-land.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/config/integrations-issues-schema.test.mjs tests/integrations/github/sync-on-land.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-890` |
| fileScopeMustChange | `src/config/defaults.mjs`, `src/config/spine-config-schema.mjs`, `src/integrations/github/sync-on-land.mjs`, `tests/config/integrations-issues-schema.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Read #387 AC for config shape and fail-closed reject
- [ ] Map current `validateIntegrationsConfig` + `resolveGithubSyncOnLandConfig`

### Step 1: Schema + defaults + reader

- [ ] Defaults: `integrations.issues = { provider: "github", syncOnLand: false }`
- [ ] Validate `provider` string + `syncOnLand` boolean when set
- [ ] Reject `integrations.github` with clear error (no alias)
- [ ] Sync reader reads `integrations.issues.syncOnLand` (rename helper OK)

### Step 2: Testing & Verification

- [ ] Schema tests: accept issues; reject github; invalid types
- [ ] Existing sync-on-land tests updated for new config path
- [ ] Run Contract `testCommand`

### Step 3: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (docs packet SP-896)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (defer to SP-896)

## Completion Criteria

- [ ] `integrations.issues` accepted; `integrations.github` rejected fail-closed
- [ ] Default provider remains `github`; syncOnLand default false
- [ ] Sync config reader uses `issues`
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `feat(SP-890): integrations.issues config schema (#387)`

## Do NOT

- Silently alias `integrations.github`
- Implement GitLab/Bitbucket providers
- Move module paths (SP-891–SP-893)
- Rename CLI flags or journal events (SP-894–SP-895)
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
