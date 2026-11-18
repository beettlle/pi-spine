# SP-867: Contract: reject .. in artifacts; fix ** globs; fail-closed on git diff failure — Status

**Current Step:** Complete
**Status:** ✅ Finished (revise cycle 1 addressed)
**Last Updated:** 2026-11-18 (revise 1)
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

Blast radius (GitNexus): `impact`/`context` for `findArtifactMatch`/`verifyContract` → target not found in index (risk UNKNOWN; resolved via text search per AGENTS rule). `findArtifactMatch` is module-private to `src/batch/contract-exec.mjs` with 4 call sites (3 prelanded/resume/base-satisfied matcher callbacks + artifactsMustExist loop). `verifyContract` (contract-exec.mjs) is wrapped by `verifyContract` (contract-verify.mjs auto-stage + matrix subst) and called from `src/batch/engine-lanes/review-final.mjs:292` and `src/batch/engine-lanes/matrix-run.mjs:322`. Existing contract-verify test fixtures use real git repos, so fail-closed git-diff gating scoped to contracts that declare `fileScopeMustNotChange` leaves them green.

- [x] GitNexus impact on `findArtifactMatch` / `verifyContract`; report blast radius in STATUS
- [x] `rg -n "findArtifactMatch|artifactsMustExist|fileScopeMustNotChange" src/batch/contract-exec.mjs tests/batch/`

---

### Step 1: Fail-closed contract checks
**Status:** ✅ Complete

- [x] Reject `..` / out-of-worktree artifact patterns
- [x] Fix `**` glob search root
- [x] Fail `fileScopeMustNotChange` when git diff fails
- [x] Revise 1: also fail `fileScopeMustNotChange` when the committed-changes lookup fails (`.reviews/final-20261118T224205.md`)

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Add/adjust unit tests for the three behaviors

Added to `tests/batch/contract-exec.test.mjs`: (1) `isUnsafeArtifactScopePattern` + `collectArtifactTraversalWarnings` unit tests, (2) runtime reject of `../` and absolute patterns incl. an existing outside-worktree file, (3) `**` glob hit tests (`src/**` + `/*.md`, `docs/**`, rooted `**`), (4) git-diff failure → must-not-change fail + no invented check when no patterns declared. 19/19 pass in the two scoped files.

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [x] Fix all failures

Contract testCommand exits 0 (lint + typecheck + 28 tests across the 4 contract files). Found + fixed en route: phase23-exit LOC gate failed (contract-exec.mjs 531 > 500) → moved `findArtifactMatch` into `src/tasks/validate-contract-warn.mjs` (460 LOC now). Broader tests/batch has 55 pre-existing failures verified byte-identical on baseline d54768e1 (zero regressions, no contract-* among them). All 146 tests across contract-* + validate-contract-warn suites pass.

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged (runbook owned by SP-865)
- [x] Create `spine-tasks/SP-867-contract-artifacts-fail-closed/.DONE`

Runbook untouched (SP-865 owns it). No docs affected.

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 1 | Final | 4 | REVISE | `.reviews/final-20261118T224205.md` |

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Final review REVISE: `fileScopeMustNotChange` only gated on uncommitted `git diff HEAD` failure; a failed `listChangedFiles` (committed files, swallows errors into `[]`) could pass on incomplete evidence | Fixed in contract-exec.mjs: committed-range probe (`git diff --name-only <since>..HEAD` or `<base>...HEAD`, visible exit code, metachar-guarded) gated on declared must-not-change patterns; failure now names the range and mentions #309. 2 new tests (no-`main` fixture; invalid `sinceCommit`) | `src/batch/contract-exec.mjs`, `tests/batch/contract-exec.test.mjs` |
| reviewCommand failed (exit 1): 0518f21  src/batch/contract-exec.mjs:261  WARNING  The fail-closed guard for must-not-change scope is incomplete: it only trigger | advisory — noted, not blocking; resolved by revise-1 fix above | contract review step |
| GitNexus index lacks `findArtifactMatch`/`verifyContract` symbols (stale) | Resolved via text-search blast radius per AGENTS UNKNOWN rule; findings in Step 0 | `src/batch/contract-exec.mjs`, `src/batch/contract-verify.mjs`, `src/batch/engine-lanes/{review-final,matrix-run}.mjs` |
| Batch 500-LOC gate (tests/cli/phase23-exit-verify) failed at 531 LOC | Moved `findArtifactMatch` + `GLOB_MAGIC_RE` into in-scope `src/tasks/validate-contract-warn.mjs`; contract-exec.mjs now 460 LOC | `scripts/loc-capstone.mjs`, `src/tasks/validate-contract-warn.mjs` |
| JSDoc block comments cannot contain a double-star-slash glob sequence (`*/` inside `**/` terminates the comment) | Concrete glob examples go in `//` line comments only | `src/tasks/validate-contract-warn.mjs` |
| 55 tests/batch + 2 adoption + a few timeout-class failures are PRE-EXISTING on baseline d54768e1 (failure sets byte-identical); `coverage:check` aborts on them before thresholds | Not SP-867's; engine/environment concern — recommend a separate investigation task | `coverage-run.tap.log`, baseline probe via detached worktree |
| `collectArtifactTraversalWarnings` exported but not yet wired into `validateContract` (`src/tasks/packet/validate-contract.mjs` out of file scope) | Runtime rejection in `findArtifactMatch` is the enforcing path; wiring is a one-liner for a follow-up task | `src/tasks/packet/validate-contract.mjs:131` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-18 | Step 1 complete | findArtifactMatch rejects ../abs + containment guard, glob root = literal prefix, git diff failure fails must-not-change; smoke-tested all behaviors |
| 2026-11-18 | Revise 1 (final review) | Added committed-range probe → must-not-change fails when committed lookup fails; message names range + #309; 2 new tests; contract testCommand exit 0 (30/30); neighbor suites 33/33; coverage 90.22%; LOC 491/500 |

---

## Blockers

*None blocking for SP-867.* Note: `scripts/worker-verify.sh` (full `npm test`) and `npm run coverage:check` exit 1 in this environment due to the pre-existing baseline failures documented in Discoveries (55 tests/batch + 2 adoption + spine-run + timeout-class, all reproduced byte-identical on d54768e1). The task's Contract `testCommand` — the declared completion gate — exits 0. Recommend an environment/infrastructure investigation task for the engine-test failures.

---

## Notes

**Completion evidence (all green, re-verified after revise 1):**
- Contract `testCommand` exits 0 (lint + typecheck + 30 tests: contract-exec, contract-verify-async, phase23-exit-verify, ts-nocheck-guard).
- Neighbor suites with must-not-change fixtures (contract-verify, contract-resume-baseline, contract-verify-serialized, contract-untracked-files, contract-base-satisfied, contract-prelanded): 33/33 pass — no regressions outside file scope.
- Changed-module line coverage (8 contract suites): contract-exec.mjs 90.22% (≥77% floor).
- contract-exec.mjs 491 LOC < 500 (phase23 batch-loc-policy gate green).
- Full-suite failures (61) proven pre-existing on d54768e1 — zero regressions, none in contract/artifact areas.
- `fileScopeMustChange` (`src/batch/contract-exec.mjs`, `tests/batch/contract-exec.test.mjs`) both changed ✓; `fileScopeMustNotChange` (`.review/**`) untouched ✓.
