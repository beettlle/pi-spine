# Task: SP-805 — `agents.quotaFallbackProfile` config + `SPINE_AGENT_PROFILE_OVERRIDE`

**Created:** 2026-10-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Config load runs for every CLI command, engine and worker spawn. A broken override would change which model every worker uses.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** #329 needs (a) a validated config key naming the fallback profile and (b) a way for the engine to make the next worker spawn resolve a different profile **without rewriting `.spine/spine-config.json`**. The worker runner reloads config on every spawn (`bin/spine-worker-runner.mjs` ~437-438 → `loadSpineConfig`), and `loadSpineConfig` (`src/config/spine-config-load.mjs` 194-240) runs `applyEnvOverrides` (215) before `applyActiveAgentProfile` (229). So an env override that sets `agents.activeProfile` reaches the runner with no runner change. Schema validation runs on the file config only, before env overrides, so the override must check profile membership itself.

## Mission

Partial #329 — Add `agents.quotaFallbackProfile` and a validated env override that selects an agent profile at load time.

1. **Schema** (`src/config/spine-config-schema.mjs`, next to `escalatePolicy` ~299-335): `agents.quotaFallbackProfile` optional string; empty string = unset; otherwise must name an existing `agents.profiles` key (same `hasOwnProperty` check and `CONFIG_AGENT_PROFILE_INVALID` code as `escalatePolicy.toProfile`). Error `suggestedCommand` uses `spine settings set agents.quotaFallbackProfile <name>`.
2. **Settings allowlist** (`src/config/settings-fields.mjs` `SETTINGS_FIELDS`, next to `agents.activeProfile` ~148-153): add `agents.quotaFallbackProfile` (string, optional) so `spine settings set agents.quotaFallbackProfile allegretto` works; `runSettingsSetOperation` already re-validates the full config.
3. **Env override** (`src/config/env-overrides.mjs`, `ENV_OVERRIDE_SPECS` ~21-24 + `applyEnvOverrides` ~125-180): `SPINE_AGENT_PROFILE_OVERRIDE=<name>` sets `agents.activeProfile` when `<name>` is a key of `agents.profiles`. When the name is unknown, do **not** apply it; record it in the result (e.g. `warnings` / `sources`) so `formatConfigSourceDetail` can show `SPINE_AGENT_PROFILE_OVERRIDE ignored: unknown profile <name>`. Empty/unset → no-op. Follow how `SPINE_TASKS_ROOT` / `SPINE_MAX_LANES` record `sources` and `envVars`.
4. **Tests:**
   - `tests/config/load.test.mjs`: `quotaFallbackProfile` valid / unknown profile → `CONFIG_AGENT_PROFILE_INVALID` / empty string accepted.
   - `tests/config/settings-fields.test.mjs`: path accepted by `parseSettingPath`.
   - `tests/config/env-overrides.test.mjs`: override applied → `loadSpineConfig(...).config.agents.worker.model` equals the override profile's worker model; unknown name ignored with recorded reason; unset → unchanged.

## Dependencies

- **None**

## Context to Read First

- GitHub #329 (Proposed solution §1, §5)
- `src/config/spine-config-schema.mjs` 248-338 (`validateAgentProfilesConfig`)
- `src/config/spine-config-load.mjs` 101-122 (`applyActiveAgentProfile`), 194-240 (`loadSpineConfig`)
- `src/config/env-overrides.mjs` 21-24, 125-208
- `src/config/settings-fields.mjs` 26, 148-153, 176; `src/cli/settings-set.mjs` 70-130

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/config/spine-config-schema.mjs`
- `src/config/settings-fields.mjs`
- `src/config/env-overrides.mjs`
- `tests/config/load.test.mjs`
- `tests/config/settings-fields.test.mjs`
- `tests/config/env-overrides.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/config/load.test.mjs tests/config/settings-fields.test.mjs tests/config/env-overrides.test.mjs` |
| fileScopeMustChange | `src/config/spine-config-schema.mjs`, `src/config/env-overrides.mjs`, `tests/config/env-overrides.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] `rg -ln "settings set|runSettingsSetOperation" tests` — add any hit to your local test run
- [ ] Read how `escalatePolicy.toProfile` is validated and how env overrides record sources
- [ ] Dependencies satisfied

### Step 1: Schema + settings

- [ ] `agents.quotaFallbackProfile` validated against `agents.profiles`
- [ ] Settings allowlist entry

**Artifacts:**
- `src/config/spine-config-schema.mjs` (modified)
- `src/config/settings-fields.mjs` (modified)

### Step 2: Profile override

- [ ] `SPINE_AGENT_PROFILE_OVERRIDE` applied before `applyActiveAgentProfile`
- [ ] Unknown profile ignored with a recorded reason

**Artifacts:**
- `src/config/env-overrides.mjs` (modified)

### Step 3: Tests

- [ ] Schema cases
- [ ] Settings path case
- [ ] Override applied / ignored / unset

**Artifacts:**
- `tests/config/load.test.mjs`, `tests/config/settings-fields.test.mjs`, `tests/config/env-overrides.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run config suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_SUPPRESS_JOURNAL_ATTACH=1 node --experimental-strip-types --test tests/config/*.test.mjs`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-811)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (env overrides list)

## Completion Criteria

- [ ] `spine settings set agents.quotaFallbackProfile <profile>` validates against `agents.profiles`
- [ ] `SPINE_AGENT_PROFILE_OVERRIDE` selects a known profile at load; unknown names ignored and reported
- [ ] With neither set, config load output is unchanged

## Git Commit Convention

- `feat(SP-805): agents.quotaFallbackProfile + SPINE_AGENT_PROFILE_OVERRIDE (#329)`

## Do NOT

- Write to `.spine/spine-config.json` from any code path
- Add `agents.escalatePolicy.*` to the settings allowlist (separate follow-up)
- Change `applyActiveAgentProfile` merge semantics
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
