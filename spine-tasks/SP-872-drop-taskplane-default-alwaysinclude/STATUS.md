# SP-872: Drop Taskplane rules from default worker alwaysInclude / init profile — Status

**Current Step:** Done
**Status:** ✅ Complete (revise cycle 1 addressed) — awaiting engine re-review (RL 1)
**Last Updated:** 2026-11-18 (revise cycle 1)
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm current alwaysInclude defaults and which tests pin Taskplane
- [x] GitNexus impact on `DEFAULT_RULES_PROFILE`; report in STATUS

---

### Step 1: Drop Taskplane from defaults
**Status:** ✅ Complete

- [x] Empty worker alwaysInclude in DEFAULT_RULES_PROFILE + templates/rules-profile.json
- [x] Adjust DEFAULT_SPINE_INIT_STANDARDS per Mission item 3

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Update assertions; prove default alwaysInclude is empty
- [x] Update `tests/config/cursor-rules/select.test.mjs` assertions that pin Taskplane in `DEFAULT_RULES_PROFILE.alwaysInclude`

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [x] Fix all failures

### Verification Evidence (Step 3)
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- Contract test suite (`profile.test.mjs`, `spine-init-rules.test.mjs`, `worker-prompt-rules.test.mjs`, `phase23-exit-verify.test.mjs`, `ts-nocheck-guard.test.mjs`) with `SPINE_WORKER_STUB=1` → exit 0, 29 tests pass
- `npm run coverage:check` (full suite, 3286 tests) → **3285 pass / 1 fail**; the single failure is Discovery #1 (`tests/config/cursor-rules/select.test.mjs:53-63` "alwaysInclude from profile") — out of File Scope, no in-scope fix possible (the test builds its own minimal manifest and passes `profile: DEFAULT_RULES_PROFILE`). Not a coverage-threshold shortfall.

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-872-drop-taskplane-default-alwaysinclude/.DONE`

### Revise Cycle 1 — Final review REPLAN addressed
**Status:** ✅ Complete

Engine final review (`.reviews/final-20261119T005745.md`) returned **REPLAN**: implementation correct, but the change breaks the out-of-scope `tests/config/cursor-rules/select.test.mjs`, and PROMPT File Scope must cover that file. Addressed per FR-REV-03:

- [x] Scope extension documented: `tests/config/cursor-rules/select.test.mjs` added per engine review verdict (planner-authority directive; recorded here per FR-WORK-06 — PROMPT.md itself not edited by worker)
- [x] Fixed `select.test.mjs:52-87`: keeps coverage of the `alwaysInclude` selection mechanism via an explicit opt-in profile (`alwaysInclude: ["taskplane-worker-cursor.mdc"]` spread over `DEFAULT_RULES_PROFILE`); adds assertion that the default profile force-includes nothing from Taskplane; always-class + no-glob assertions preserved
- [x] Re-verified: lint exit 0, typecheck exit 0, contract suite (5 PROMPT files + `select.test.mjs`) exit 0, full `npm run coverage:check` with worker env unset → **3286/3286 pass, 0 fail, line coverage 91.45% ≥ 77%**

## Completion Criteria

- [x] Default worker alwaysInclude is empty (`src/config/cursor-rules/profile.mjs`)
- [x] Init template matches (`templates/rules-profile.json`)
- [x] Tests updated and green (3 in-scope test files updated; contract suite 29/29 pass)
- [x] Contract `testCommand` exits 0 (lint exit 0, typecheck exit 0, tests exit 0)

> Coverage gate note (revise cycle 1): `npm run coverage:check` → **3286/3286 pass, exit 0, 91.45% ≥ 77%** — the former out-of-scope `select.test.mjs` failure is fixed (see Revise Cycle 1). Docs sentence for runbook:126 remains logged in Discovery #2 (docs out of File Scope).
>
> Env note: run coverage/full-suite with `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`) — see Discovery #6.

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 1 | Plan (step 0) | 0 | APPROVE | `.reviews/0-20261119T005419.md` |
| 2 | Final | — | REPLAN → addressed (revise cycle 1) | `.reviews/final-20261119T005745.md` |

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): 97cfbeb  tests/config/cursor-rules/select.test.mjs:69  ERROR  The assertion expects `withOptIn.paths` to include `.cursor/rules/t | advisory — noted, not blocking | contract review step |
| #1 Out-of-scope `select.test.mjs` breakage | **Resolved** in revise cycle 1 (engine REPLAN verdict extended scope) | `tests/config/cursor-rules/select.test.mjs:52-87` |
| #2 Docs stale: `docs/adoption/operator-runbook.md:126` says taskplane-worker-cursor.mdc is default alwaysInclude | Open — docs not in File Scope; suggested sentence: worker alwaysInclude is empty by default; Taskplane rules are opt-in via explicit `alwaysInclude` | `docs/adoption/operator-runbook.md:126` |
| #3 Reviewer neverInclude kept per Mission item 1 | Done | `src/config/cursor-rules/profile.mjs` |
| #4 Repo dogfood `.spine/rules-profile.json` neverInclude entry now redundant but harmless; `.spine/` out of scope | No action | `.spine/rules-profile.json` |
| #5 Selection semantics: `selectRulesForWorker` selects profile `alwaysInclude` AND manifest `alwaysApply` rules; emptying default drops only the force-include | Documented | `src/config/cursor-rules/select.mjs:211-212` |
| #6 Batch-engine tests (61) fail as `nested_batch_spawn_blocked` when run inside worker session — `SPINE_IS_WORKER=1` env leaks into spawned batch processes (SP-482 guard working as designed) | Not a regression; run full suite with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER` per PROMPT Environment | `tests/batch/*.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-18 | Steps 0–4 executed, .DONE created | Contract suite green; full suite 3285/3286 (select.test.mjs out-of-scope failure logged) |
| 2026-11-18 | Engine final review | **REPLAN** — fix out-of-scope `select.test.mjs`, extend File Scope |
| 2026-11-18 | Revise cycle 1 | `select.test.mjs` fixed (opt-in profile + default-empty assertions); contract suite exit 0; full coverage run 3286/3286 pass, 91.45%; `.DONE` recreated |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*

## Step 0 Preflight Findings

### Current defaults (confirmed)
- `src/config/cursor-rules/profile.mjs:46` — `DEFAULT_RULES_PROFILE.worker.alwaysInclude = ["taskplane-worker-cursor.mdc"]`
- `templates/rules-profile.json` — worker `alwaysInclude` mirrors the default (`["taskplane-worker-cursor.mdc"]`)
- `src/config/worker-context.mjs:19-25` — `DEFAULT_SPINE_INIT_STANDARDS` lists `taskplane-task-authoring.mdc` + `taskplane-worker-cursor.mdc`. Init seeding of this constant was superseded by SP-093 (`spine init` sets `standards: []`); sole remaining consumer is the `tests/config/worker-context.test.mjs` fixture. No Taskplane-compat preset exists in repo/configs → no carve-out; both taskplane entries removed, 3 spine-native entries kept.

### Tests pinning Taskplane alwaysInclude
- `tests/config/cursor-rules/profile.test.mjs:17,39` — default + missing-file assertions (in scope, updated)
- `tests/cli/spine-init-rules.test.mjs:36` — init-copied profile assertion (in scope, updated)
- `tests/batch/worker-prompt-rules.test.mjs:89,154` — "default always rule selected/still selected": fixture rule has `alwaysApply: true`, so it remains selected post-change via manifest `always` class; wording updated + explicit `source === "alwaysInclude"` absence assertion added (in scope)

### GitNexus impact: DEFAULT_RULES_PROFILE (upstream)
- `risk: UNKNOWN` (0 callers resolved by index — bare module-scope const reads). Per standing orders, confirmed via text search:
  - `src/config/cursor-rules/discover.mjs:219` — fallback when profile load fails
  - `src/config/cursor-rules/index.mjs` — re-export
  - Tests: `profile.test.mjs`, `select.test.mjs`, `select-reviewer.test.mjs`, `discover.test.mjs`
- No src code branches on non-empty worker alwaysInclude. Low blast radius.

### Discoveries
1. **Out-of-scope test breakage (needs follow-up):** `tests/config/cursor-rules/select.test.mjs:53-63` ("selectRulesForWorker includes alwaysInclude and always-class rules") uses `profile: DEFAULT_RULES_PROFILE` against a manifest that lacks `taskplane-worker-cursor.mdc` and asserts it is selected ("alwaysInclude from profile"). Breaks once the default is empty — **empirically confirmed post-change (1 failing test)**. File is NOT in File Scope (FR-WORK-06) and NOT in the Contract testCommand — not edited here. Fix is 3 lines: drop that one assertion (the `critical-rules-quick-reference.mdc` "always-class" assertion already covers the behavior). Flagged for planner amendment or follow-up task; full-suite release:check at post-integrate WILL hit this test.
2. **Docs stale (needs sentence):** `docs/adoption/operator-runbook.md:126` — "`Always-include (taskplane-worker-cursor.mdc by default)`" becomes wrong. Docs not in File Scope → logged, not edited. Suggested sentence: worker alwaysInclude is empty by default; Taskplane rules are opt-in via explicit `alwaysInclude`.
3. **Reviewer neverInclude kept** per Mission item 1 — harmless, documents intent.
4. **Repo dogfood `.spine/rules-profile.json`** already `neverInclude`s `taskplane-worker-cursor.mdc` (opting out of today's forced default). After this change that entry is redundant but harmless; `.spine/` is out of scope (Do NOT edit).
5. **Selection semantics** (for reviewers): `selectRulesForWorker` selects from profile `alwaysInclude` AND manifest rules with `spineClass === "always"` (`alwaysApply: true` frontmatter). Emptying the default profile does NOT stop `alwaysApply` rules from being selected — only the profile force-include is dropped.
