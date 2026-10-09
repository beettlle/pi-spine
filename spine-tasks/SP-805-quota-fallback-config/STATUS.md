# SP-805: `agents.quotaFallbackProfile` config + profile override — Status

**Current Step:** Step 5: Documentation & Delivery
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-09
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] settings-set tests located
- [x] Validation + source-recording patterns read
- [x] Dependencies satisfied

### Step 1: Schema + settings
**Status:** ✅ Done

- [x] Schema validation
- [x] Settings allowlist

### Step 2: Profile override
**Status:** ✅ Done

- [x] Override applied before profile resolution
- [x] Unknown profile ignored + reported

### Step 3: Tests
**Status:** ✅ Done

- [x] Schema cases
- [x] Settings path
- [x] Override cases

### Step 4: Testing & Verification
**Status:** ✅ Done

- [x] Lint
- [x] Contract `testCommand`
- [x] Config suite
- [x] Coverage gate
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ✅ Done

- [x] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `rg` settings-set hits beyond config suite: `tests/spine-settings-set.test.mjs`, `tests/spine-settings-slash.test.mjs`, `tests/doctor/model-id-validation.test.mjs`, `tests/extensions/slash-commands-handlers.test.mjs` — run locally in Step 4. |
| 2 | GitNexus impact (`applyEnvOverrides`, `validateAgentProfilesConfig`): LOW risk, no direct upstream callers beyond `loadSpineConfig`/`validateSpineConfig`. |
| 3 | The initial `sources[configPath] = "file"` seed loop in `applyEnvOverrides` covers every spec uniformly; adding the new spec adds a `file` entry for `agents.activeProfile`, harmless (display code defaults to `file` anyway). |
| 4 | Preflight-flagged settings-set suites all pass: `spine-settings-set` / `spine-settings-slash` / `doctor/model-id-validation` / `extensions/slash-commands-handlers` — 67/67. |
| 5 | First two `npm run coverage:check` runs aborted on 2 timing tests (`tests/batch/sequence-detached-poll.test.mjs`, SP-802's `waitForSequenceBatchTerminal` wall-clock asserts) — machine had 54 concurrent node processes from sibling lane workers. Both tests pass in isolation (with and without my diff, with and without instrumentation). Third full run passed clean: **2783/2783 tests, 90.07% line coverage ≥ 77% gate**. |
| 6 | `coverage:check` inherits `SPINE_IS_WORKER` → batch-spawning tests fail with `nested_batch_spawn_blocked` unless run with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER` (as PROMPT specifies). |
| 7 | `docs/adoption/operator-runbook.md` mentions env overrides (SPINE_TASKS_ROOT/SPINE_MAX_LANES examples at lines 448-449, 737) but docs are explicitly deferred to SP-811 per PROMPT ("Must Update: None (SP-811)"). |
| 8 | `.spine/rules-manifest.json` gets regenerated (timestamp-only) by tooling hooks during test runs; reverted to keep the Do-NOT rule. |

## Blockers

_None._
