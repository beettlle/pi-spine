# SP-829: Hermetic worker-prompt-rules tests — Status

**Current Step:** Complete
**Status:** ✅ Done (commit a2e3c0f4)
**Last Updated:** 2026-10-14
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Failures reproduced (2/4 fail: repo `.spine/rules-profile.json` `worker.neverInclude` blocks `general-llm-anti-patterns.mdc` + `javascript-3-development-standards.mdc` at `projectRoot: PROJECT_ROOT`)
- [x] Profile validator keys confirmed (`profileVersion` must be 1; worker/reviewer `alwaysInclude`/`neverInclude` string arrays, no `..`; `globMatch` boolean; `reviewer.enabled` boolean; `reviewer.maxRules` positive int; discovery arrays; invalid → `RULES_PROFILE_INVALID` → static fallback with `selection.profileError`)
- [x] Dependencies satisfied

### Step 1: Fixture and rewrite
**Status:** ✅ Complete

- [x] Fixture helper (`createRulesFixture`: mkdtemp + on-disk `.cursor/rules` + optional `.spine/rules-profile.json`)
- [x] Two tests on the fixture (tail prompt + auto selection; standards append/dedupe end-to-end)
- [x] `neverInclude` precedence test (gold-rule.mdc in both arrays → blocked; default always rule still selected)

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Lint (`eslint --max-warnings 0` on the file — exit 0)
- [x] Contract `testCommand` (batch suite: 1693/1693 pass with worker env stripped; 6/6 for this file)
- [x] Fix all failures (baseline 2 failures eliminated; suite-wide `SPINE_IS_WORKER=1` interference proven pre-existing via `git stash` baseline — 3/3 pass without env, unrelated to this change)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Baseline failures were repo-coupled: `.spine/rules-profile.json` in this repo sets `worker.neverInclude` including `general-llm-anti-patterns.mdc` and `javascript-3-development-standards.mdc`, so `projectRoot: PROJECT_ROOT` selection tests failed inside the repo but could pass elsewhere. |
| 2 | Fixture pattern proven from `tests/config/worker-context.test.mjs`: mkdtemp root + `.cursor/rules/*.mdc` with minimal frontmatter. Frontmatter parser (`src/config/cursor-rules/parse-frontmatter.mjs`) accepts JSON-array `globs: ["src/**/*.mjs"]`; description-only rules classify as `manual` (never auto-selected) — ideal for standards/neverInclude assertions. |
| 3 | `mergeRulesProfile` enforces neverInclude-wins by filtering `worker.alwaysInclude` through the merged neverInclude set (defaults ∪ file). The precedence test asserts this end-to-end via `buildWorkerContextAsync`. |
| 4 | Invalid profiles (`RULES_PROFILE_INVALID`, e.g. `..` traversal in `neverInclude`, `reviewer.maxRules: 0`) make `buildWorkerContextAsync` fall back to static mode with `selection.profileError` set. |
| 5 | `npm run test:batch` fails en masse inside worker sessions because inherited `SPINE_IS_WORKER=1` blocks nested batch spawns; baseline verification (git stash) shows the same files pass without the env var. Unrelated to SP-829. |

## Blockers

_None._
