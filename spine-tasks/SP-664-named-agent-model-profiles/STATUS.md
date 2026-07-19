### Step 0: Config Schema Updates
**Status:** ✅ Complete

- [x] Add `agents.profiles` to schema.
- [x] Add `agents.activeProfile` to schema.
- [x] Add optional `agents.escalatePolicy` to schema.

### Step 1: Implementation
**Status:** ✅ Complete

- [x] Update `load.mjs` (spine-config-load.mjs) to apply activeProfile.
- [x] Update `doctor.mjs` (agent-models.mjs) to validate profile model IDs.
- [x] Update `settings.mjs` (settings-fields.mjs) to support activeProfile switching.

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Tests pass
- [ ] Coverage ≥ 77%

## Discoveries

| Finding | Detail |
| --- | --- |
| File path mapping | PROMPT uses short names. Actual files: `load.mjs`→`src/config/spine-config-load.mjs`; `doctor.mjs`→`src/doctor/agent-models.mjs` (+`run-doctor-checks.mjs`); `settings.mjs`→field registry in `src/config/settings-fields.mjs` consumed by `src/cli/settings-set.mjs`; test `tests/config/load.test.mjs` does not yet exist (to be created). |
| Impact (CRITICAL) | `validateSpineConfig` has 52 downstream impacts. Edit is purely additive (new validation branch active only when new fields present); signature unchanged; existing valid configs stay valid. Proceeding. |
| Profile shape | `agents.profiles.<name>` mirrors base `worker`/`reviewer`/`supervisor` agent sections. `activeProfile` selects the live profile, deep-merged over base at load time (profile wins, base fills gaps). `escalatePolicy` is optional schema-only (`enabled`, `toProfile`). |
| Env override safety | FR-CFG-04 env overrides only touch `paths.tasksRoot` and `lanes.maxParallel` — never agent models — so resolving the active profile after env application is safe. |
