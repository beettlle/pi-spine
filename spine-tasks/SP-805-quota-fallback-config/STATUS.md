# SP-805: `agents.quotaFallbackProfile` config + profile override — Status

**Current Step:** Step 1: Schema + settings
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
**Status:** ⬜ Not Started

- [ ] Schema validation
- [ ] Settings allowlist

### Step 2: Profile override
**Status:** ⬜ Not Started

- [ ] Override applied before profile resolution
- [ ] Unknown profile ignored + reported

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Schema cases
- [ ] Settings path
- [ ] Override cases

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Config suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `rg` settings-set hits beyond config suite: `tests/spine-settings-set.test.mjs`, `tests/spine-settings-slash.test.mjs`, `tests/doctor/model-id-validation.test.mjs`, `tests/extensions/slash-commands-handlers.test.mjs` — run locally in Step 4. |
| 2 | GitNexus impact (`applyEnvOverrides`, `validateAgentProfilesConfig`): LOW risk, no direct upstream callers beyond `loadSpineConfig`/`validateSpineConfig`. |
| 3 | The initial `sources[configPath] = "file"` seed loop in `applyEnvOverrides` covers every spec uniformly; adding the new spec adds a `file` entry for `agents.activeProfile`, harmless (display code defaults to `file` anyway). |

## Blockers

_None._
