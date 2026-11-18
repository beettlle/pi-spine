# SP-869: Validate --batch IDs at CLI entry points; sanitize review baseline — Status

**Current Step:** Complete
**Status:** ✅ All Steps Complete
**Last Updated:** 2026-11-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] `rg -n "--batch|validateBatchId" bin/ src/cli/ src/batch/` — list entry points missing validation
  - **Unvalidated `--batch` argv readers (fixed in Step 1):** `bin/spine-gate.mjs`, `bin/spine-integrate.mjs`, `bin/spine-batch.mjs` (`parseBatchArgs`), `bin/spine-journal.mjs` (replay + export), `bin/spine-state.mjs`, `src/cli/handoff.mjs`.
  - **Already validated (no change needed):** `src/cli/journal-follow.mjs` + `src/cli/lane-logs.mjs` (both route through `resolveFollowBatchId` → `validateBatchId`, covered by existing tests in `tests/batch/batch-id-validation.test.mjs`).
  - **Baseline:** engine code-review path is already SHA-gated (`isValidCommitSha` in `src/batch/contract-task-start.mjs`, #343; `review-code.mjs:119`). Unvalidated sink: `bin/spine-review-step.mjs --baseline` (raw) → `buildReviewRequest` prompt interpolation + `resolveCodeReviewScopePaths` git argv; also `src/cli/rules.mjs --baseline` → `resolveReviewScopePaths`.
- [x] GitNexus impact on `validateBatchId` / review baseline; report in STATUS
  - **GitNexus impact result: UNKNOWN** — `impact` returned "Target 'validateBatchId' not found"; this lane worktree has no `.gitnexus/` and the task forbids modifying `.gitnexus/`, so the index could not be consulted. Per AGENTS.md, UNKNOWN is treated as unresolved and confirmed by exhaustive text search instead: `validateBatchId` callers = `src/cli/journal-follow.mjs` (resolveFollowBatchId) and `src/batch/state.mjs` (re-export only); `resolveCodeReviewScopePaths` callers = `resolveReviewScopePaths` (review-scope.mjs) and tests; `buildReviewRequest` caller = `src/batch/review-step-run.mjs`; `resolveReviewScopePaths` callers = `src/batch/review-step.mjs` + `src/cli/rules.mjs`.

---

### Step 1: Validate --batch + baseline
**Status:** ✅ Complete

- [x] Wire `validateBatchId` at all CLI `--batch` readers listed in Mission
  - `bin/spine-gate.mjs` — `resolveActiveBatchId` validates; throw → structured result (exit 2, human + `--json`).
  - `bin/spine-integrate.mjs` — validates before `integrateOrchToBase` (exit 2 + usage).
  - `bin/spine-batch.mjs` — `runSpineBatch` validates `parsed.batchId` after parse (exit 1).
  - `bin/spine-journal.mjs` — `runJournalReplay` + `runJournalExport` validate (exit 1 + usage).
  - `bin/spine-state.mjs` — validates before `resolveBatchStateFileForValidation` (exit 1, human `❌` + `--json`).
  - `src/cli/handoff.mjs` — `runSpineHandoff` validates before `assembleHandoffData` (exit 1).
  - `spine metrics show` (`bin/spine.mjs`) and `lane logs` (`src/cli/lane-logs.mjs`) are **out of File Scope**; lane-logs already validates via `resolveFollowBatchId`; metrics `batchId` is a JSONL line-equality filter only (no path join) — see Discoveries.
- [x] Add baseline allowlist helper; use in review-step / review-scope before git/prompt
  - `src/batch/batch-id.mjs`: `REVIEW_BASELINE_PATTERN`, `reviewBaselineRejectionReason`, `validateReviewBaseline` (first char alphanumeric → rejects `-` options and absolute paths; rejects whitespace/newlines, `..` traversal, metacharacters; allows full/short SHA + plain refs incl. `origin/main`).
  - `src/batch/review-scope.mjs`: `resolveCodeReviewScopePaths` validates before git argv (throws → fails the review step closed, no silent fallback).
  - `src/batch/review-step.mjs`: `buildReviewRequest` validates before prompt interpolation.

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Malicious `--batch` rejected
  - `tests/cli/gate-batch-id.test.mjs` (NEW): traversal ID for every gate action (exit 2, human), `--json` structured error, option-shaped values (strict-argv `Unknown option`, exit 2), parseable-but-unsafe values (`a..b`, whitespace, `/etc/passwd` → `Invalid batch ID`), and a valid ID proceeding past the boundary (`No integrate gate on record`, exit 0).
  - `tests/batch/batch-id-validation.test.mjs` (extended): `spine integrate`, `spine batch abort`, `spine journal replay/export` (incl. `--batch --output=/` option-injection value), `spine state validate` (human + json), `spine handoff` rejections.
- [x] **Revise cycle:** bare `--batch` (flag without a value) regression test — seeds an active `.spine/batch-state.json`, asserts `dismiss --batch` is rejected with `Invalid batch ID ""` and the active batch is untouched; also covers `dismiss --batch --yes` (`--yes` consumed as the value → rejected), journal replay/export, state validate, and handoff bare-flag cases.
- [x] Malicious baseline rejected; safe SHA still works
  - `tests/batch/review-baseline-validate.test.mjs` (NEW): allowlist accept matrix (short/full SHA, `main`, `origin/main`, `v1.2.3`), reject matrix (`--output=…`, `-x`, `../evil`, `main..HEAD`, whitespace/newlines, `HEAD~1`/`HEAD^`/`@{u}`, backslash, absolute path, non-strings), `resolveCodeReviewScopePaths` throws **before git runs** (gitRan asserted false), safe SHA passes as single rev arg `abc1234..HEAD`, `resolveReviewScopePaths` fails closed for code+final (no silent File-Scope fallback), `buildReviewRequest` throws pre-interpolation and keeps `git diff abc1234..HEAD` for safe SHAs.
  - Result: 28/28 pass across the three files; 34/34 after the revise cycle.

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
  - Contract `testCommand` exit 0: `npm run lint` clean, `npm run typecheck` clean (both tsconfig projects), 33/33 targeted tests pass.
  - Additionally ran `./scripts/worker-verify.sh` (typecheck + full suite). First run failed with 45+ `nested_batch_spawn_blocked` errors — the script inherits `SPINE_IS_WORKER=1` from the worker session; PROMPT Environment requires the vars unset. Re-ran with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER ./scripts/worker-verify.sh`: **exit 0, 3284/3284 tests pass**. None of the first-run failures touched task files; all were the nested-spawn guard.
  - **Revise cycle re-run:** Contract `testCommand` exit 0 (lint + typecheck clean, 34/34 targeted tests incl. the new bare-flag regression test); full suite `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER ./scripts/worker-verify.sh` **exit 0, 3285/3285 pass**.
- [x] Fix all failures
  - Initial run: no task-code failures; the only failures were environment-caused (see above) and pass with the prescribed environment.
  - Revise cycle: bare `--batch` validation bypass flagged by final review — fixed and re-verified (see Step 2 and Discoveries).

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-869-batch-id-baseline-validate/.DONE`

## Completion Criteria

- [x] All `--batch` CLI entry points validate IDs — `spine gate`, `spine integrate`, `spine batch`, `spine journal` (replay/export), `spine state`, `spine handoff` all reject unsafe IDs with non-zero exit + clear error; out-of-scope readers (`metrics show`, `lane logs`) audited and either already validated or not a path-join sink (see Discoveries).
- [x] Unsafe baselines rejected before git/prompt use — `validateReviewBaseline` enforces the allowlist at `resolveCodeReviewScopePaths` (git argv) and `buildReviewRequest` (prompt text), failing the review step closed.
- [x] Contract `testCommand` exits 0 — lint clean, typecheck clean, 33/33 targeted tests pass; full suite 3284/3284 via `worker-verify.sh` with `SPINE_IS_WORKER` unset.

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 1 | plan | 0 | APPROVE | `.reviews/0-20261118T232018.md` |
| 2 | final | — | REVISE → addressed (bare `--batch` bypass) | `.reviews/final-20261118T233137.md` |

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): e4c242d  bin/spine-gate.mjs:83  ERROR  The function `resolveActiveBatchId` is expected to return a string (the batch ID), but `va | advisory — noted, not blocking | contract review step |
| reviewCommand failed (exit 1): `bin/spine-batch.mjs:270` — bare `--batch` (flag without a value) bypassed validation and fell back to the active batch | **Fixed in revise cycle** (final review made it blocking): `parseBatchArgs` now captures bare `--batch` as `""`, validation guards changed from truthiness to `!= null` in `spine-batch`/`spine-journal` (replay+export)/`spine-state`/`handoff`; regression test seeds an active batch and asserts it is untouched | `bin/spine-batch.mjs`, `bin/spine-journal.mjs`, `bin/spine-state.mjs`, `src/cli/handoff.mjs`, `tests/batch/batch-id-validation.test.mjs` |
| GitNexus `impact` returned UNKNOWN (no `.gitnexus/` in lane worktree; task forbids modifying `.gitnexus/`) | Confirmed blast radius by exhaustive `rg` text search instead (callers of `validateBatchId`, `resolveCodeReviewScopePaths`, `buildReviewRequest`, `resolveReviewScopePaths`) | STATUS Step 0 |
| `bin/spine.mjs` (`metrics show`) and `src/cli/lane-logs.mjs` are `--batch` readers outside File Scope | No change needed: lane-logs already validates via `resolveFollowBatchId`; metrics `batchId` is a JSONL line-equality filter (`filterMetricsLines`), never joined into paths. Follow-up only if metrics gains path joins | `src/batch/metrics.mjs:426` |
| `parseStrictArgs` (gate/integrate) already refuses `--`-prefixed values before ID validation | Defense-in-depth retained; manual parsers (journal/state/handoff/batch) rely on `batchIdRejectionReason` | `bin/spine-gate.mjs`, `bin/spine-integrate.mjs` |
| Engine code-review baseline was already SHA-gated via `isValidCommitSha` (#343) | New sink validation covers the raw CLI paths: `spine review step --baseline` and `spine rules --baseline` | `src/batch/contract-task-start.mjs:17`, `src/batch/engine-lanes/review-code.mjs:119` |
| Baseline allowlist intentionally excludes revision syntax (`~`, `^`, `@{`) and `:` | Operators pass a SHA instead; `/` allowed for plain refs (`origin/main`); documented in JSDoc | `src/batch/batch-id.mjs` |
| `docs/adoption/operator-runbook.md` check | No update needed: error messages are self-explanatory at the point of failure (`Invalid batch ID "…": <reason>`); preferring Discoveries per PROMPT | — |
| `worker-verify.sh` inherits `SPINE_IS_WORKER=1`, breaking engine-integration tests inside worker sessions | Re-ran with vars unset per PROMPT Environment; consider unsetting in the script upstream (out of scope here) | `scripts/worker-verify.sh` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
