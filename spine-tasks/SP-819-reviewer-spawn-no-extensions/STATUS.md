# SP-819: Reviewer spawns skip user pi extensions by default — Status

**Current Step:** Step 1: Reviewer args
**Status:** 🔵 Executing
**Last Updated:** 2026-10-14
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Exact-args tests listed
- [x] Schema strictness recorded
- [x] Dependencies satisfied

### Step 1: Reviewer args
**Status:** ⬜ Not Started

- [ ] `-ne` default + opt-out

### Step 2: Config key
**Status:** ⬜ Not Started

- [ ] Settings field
- [ ] Schema validation

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Arg cases
- [ ] Settings and schema cases

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `buildReviewerPiArgs` (upstream, depth 3): 0 impacted, risk LOW (epistemic: exact — graph is sparse here). GitNexus context fills the gap: direct caller `spawnReviewerPi` (same file); production consumers `review-step-run.mjs` (`runStepReview` → plan/code/final reviews) and `engine-lanes/review-plan.mjs`; test consumers `review-spawn.test.mjs`, `nested-reviewer-guard.test.mjs`. Manual risk read: MEDIUM — every engine and CLI review spawns through it. |
| 2 | Exact-args tests: only `tests/batch/review-spawn.test.mjs` asserts reviewer argv, and it is in File Scope. Its "omits --model when reviewer model is inherit" test hardcodes `thinkingIndex === 2` and `piArgs[3] === "high"`; both shift by +1 when `-ne` is prepended (in-scope update). Worker argv tests (`tests/agents/worker-runner.test.mjs`, `tests/batch/worker-model-pin.test.mjs`) assert worker args — out of scope, untouched. No Amendments required. |
| 3 | Schema strictness: `src/config/spine-config-schema.mjs` does NOT reject unknown `agents.reviewer` keys — validation is per-key (e.g. `validateAgentSectionModelTypes`, `escalatePolicy.enabled`). An explicit boolean check for `loadUserExtensions` on base `agents.reviewer` and `agents.profiles.<name>.reviewer` is required (added in Step 2, code `CONFIG_AGENT_PROFILE_INVALID`). |
| 4 | Dependencies satisfied: `scripts/spine-stet-contract-run.sh`, `.review/config.toml`, and the `stet` binary (version dev) are all present. |
| 5 | `tests/spine-settings-show.test.mjs` asserts field lists relative to `SETTINGS_FIELDS` (`length`, mirrored deepEqual) — adding a field cannot break it. `tests/spine-settings-set.test.mjs` has no argv/field-enumeration coupling to the new key. |

## Blockers

_None._
