# SP-819: Reviewer spawns skip user pi extensions by default — Status

**Current Step:** Complete
**Status:** ✅ Done — awaiting batch final review
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
**Status:** ✅ Complete

- [x] `-ne` default + opt-out

### Step 2: Config key
**Status:** ✅ Complete

- [x] Settings field
- [x] Schema validation

### Step 3: Tests
**Status:** ✅ Complete

- [x] Arg cases
- [x] Settings and schema cases

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint
- [x] Contract `testCommand`
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `buildReviewerPiArgs` (upstream, depth 3): 0 impacted, risk LOW (epistemic: exact — graph is sparse here). GitNexus context fills the gap: direct caller `spawnReviewerPi` (same file); production consumers `review-step-run.mjs` (`runStepReview` → plan/code/final reviews) and `engine-lanes/review-plan.mjs`; test consumers `review-spawn.test.mjs`, `nested-reviewer-guard.test.mjs`. Manual risk read: MEDIUM — every engine and CLI review spawns through it. |
| 2 | Exact-args tests: only `tests/batch/review-spawn.test.mjs` asserts reviewer argv, and it is in File Scope. Its "omits --model when reviewer model is inherit" test hardcodes `thinkingIndex === 2` and `piArgs[3] === "high"`; both shift by +1 when `-ne` is prepended (in-scope update). Worker argv tests (`tests/agents/worker-runner.test.mjs`, `tests/batch/worker-model-pin.test.mjs`) assert worker args — out of scope, untouched. No Amendments required. |
| 3 | Schema strictness: `src/config/spine-config-schema.mjs` does NOT reject unknown `agents.reviewer` keys — validation is per-key (e.g. `validateAgentSectionModelTypes`, `escalatePolicy.enabled`). An explicit boolean check for `loadUserExtensions` on base `agents.reviewer` and `agents.profiles.<name>.reviewer` is required (added in Step 2, code `CONFIG_AGENT_PROFILE_INVALID`). |
| 4 | Dependencies satisfied: `scripts/spine-stet-contract-run.sh`, `.review/config.toml`, and the `stet` binary (version dev) are all present. |
| 5 | `tests/spine-settings-show.test.mjs` asserts field lists relative to `SETTINGS_FIELDS` (`length`, mirrored deepEqual) — adding a field cannot break it. `tests/spine-settings-set.test.mjs` has no argv/field-enumeration coupling to the new key. |
| 6 | Stet triage (Contract, SP-828 script): 9 findings. Fixed 1 real defect — `assertReviewerArgShape` JSDoc missing `worktreePath` property (39c95c0). Dismissed 8 with evidence: 5 false positives (critic saw partial diff hunks — `validateReviewerLoadUserExtensions` IS called twice in the diff; `applyActiveAgentProfile` IS used; base-reviewer check runs before the profiles early-return, proven by no-profiles tests; `validateSpineConfig` delegates at `spine-config-load.mjs` ~313; 'pi' is the CLI name, not a typo), 2 already_correct (opt-out documented in JSDoc; `spine init --force` matches sibling profile-error convention), 1 out_of_scope (index assertions are the file's pre-existing pattern and PROMPT-mandated position checks). |
| 7 | Stet reviewer bug (stale hunk): after the 39c95c0 fix was committed, the re-run still reported the finding against the pre-fix hunk (file verified fixed on disk, `stet doctor` healthy). Dismissed `already_correct` citing the fix commit; follow-up re-run reported 0 findings. |

## Blockers

_None._

---

## Verification Evidence (all run in foreground, in-session)

| Check | Result |
|-------|--------|
| `npm run lint` (eslint --max-warnings 0) | Pass, clean |
| `npm run typecheck` (tsc × 2 projects) | Pass, clean |
| Contract scoped tests (7 files) | 114/114 pass, 0 fail (TAP: `# pass 114 # fail 0`) |
| `bash scripts/spine-stet-contract-run.sh default` | 0 findings, exit 0 (after triage: 1 fixed, 8 dismissed with evidence) |
| File scope | 6 changed files, exactly the File Scope; `.review/**` and worker spawn args untouched |

## Completion Criteria

- [x] `buildReviewerPiArgs` includes `-ne` by default; asserted by "buildReviewerPiArgs passes -ne by default so reviewers skip user pi extensions"
- [x] With `agents.reviewer.loadUserExtensions: true`, reviewer args omit `-ne`; schema rejects non-boolean (base + profile) and `spine settings set` coerces/accepts the key
- [x] Reviewer model, thinking, system prompt, and prompt arguments otherwise unchanged (asserted across default/true/false toggles)
