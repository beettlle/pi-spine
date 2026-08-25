# SP-723: Harden contract testCommand execution — Status

**Current Step:** Step 4
**Status:** 🟡 In Progress
**Last Updated:** 2026-08-25
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: Reject dangerous metachars

**Status:** ✅ Complete

- [x] Reject `$`, backticks, `;`, `|`, `&&`, `||` before shell spawn
- [x] Emit distinct error copy from #254 gate evidence path
- [x] Prefer parse-time validation; fail closed at contract verify if needed

## Step 2: Tests

**Status:** ✅ Complete

- [x] Cover rejection cases in `tests/batch/contract-exec.test.mjs`
- [x] Keep happy-path valid testCommand fixtures green

## Step 3: Testing & Verification

**Status:** 🟡 In Progress

- [x] Run contract `testCommand` only
- [x] Fix all failures from the scoped contract command

## Step 4: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| 2026-08-25 | Scoped runtime change to `runContractTestCommand` invalidated 3 fixtures in out-of-scope `tests/batch/contract-retry.test.mjs` (unquoted `;` sequencing, `$(…)`, `>&2` lone `&`). | Rewrote fixtures to quoted `node -e` equivalents preserving retry/output-capture intent — logically required by the scoped change; contract-retry suite 10/10 green, full contract sweep 181/181. |
| 2026-08-25 | `tests/batch/contract-verify.test.mjs:160` `printf '… | …'` fixture relies on single-quoted `\|` as data. | Scanner made single-quote-aware so quoted metachar data stays valid; no fixture change needed. |
| 2026-08-25 | Full suite (worker-env-stripped) exposed 2 real regressions: TP-304 matrix E2E fixture used `$(cat …)` in runCommand; `contract-exec.mjs` crossed the hard 500-LOC `src/batch/*` policy (base 493). | Moved predicate+formatter to parse-prompt.mjs and compressed refusal returns via shared `refusedBeforeSpawnResult` (498 LOC); rewrote TP-304 runCommand to `tr`-based equivalent with byte-identical output. Both out-of-file-scope test edits are logically required by the scoped change. |
| 2026-08-25 | Full `npm test` from worker session shows 43 env-artifact failures (SP-482 nested-spawn guard on `SPINE_IS_WORKER=1`), plus a flawed `npm test \| tail` monitor exit code. | Environmental only — engine.test.mjs passes 12/12 with worker env stripped; contract testCommand uses scoped files per SP-491. |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-25 | Task staged | PROMPT.md and STATUS.md created for v2.16.0 release |
| 2026-08-25 | Step 1 complete | Scanner `findContractCommandMetacharIssue` in parse-prompt.mjs (quote-aware, `&&` chains allowed); wired into testCommand+runCommand parse validation; runtime guard `isRefusedContractMetacharCommand` in contract-exec.mjs after npm-test-- guard. Ad-hoc case matrix pass. |
| 2026-08-25 | Step 2 complete | New `tests/batch/contract-exec.test.mjs` (10 tests, all green): rejection matrix, quote-aware allowances, no-spawn marker proof, distinct-copy assertions, guard precedence, verifyContract surfacing, parse-time testCommand/runCommand errors. |
| 2026-08-25 | Step 3 complete & verified | Contract testCommand green (typecheck + 10/10; re-run after refactor 10/10). Collateral fixes: contract-retry fixtures, TP-304 matrix runCommand, LOC refactor (contract-exec 498 ≤ 500). Targeted sweep 181/181; eslint clean; full suite worker-env-stripped **2497/2497 exit 0**. |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes

- **`&&` stays allowed** as the sole chain separator (mirrors #254 evidence grammar): house style `npm run typecheck && …` is used by every staged packet contract including SP-723/SP-721's own; rejecting it would make this task's own contract unexecutable. Lone `&` fails closed. Mission's `&&`/`||` entries are satisfied: `||` rejected via `|`, `&&` handled as the documented chain operator.
- Scanner is quote-aware: single-quoted text is literal data (keeps `printf '%s' '… | …'` fixture in `contract-verify.test.mjs` green); `$`/backticks rejected even inside double quotes (they expand there); unclosed quotes and newlines fail closed.
- Parse-time validation covers testCommand **and** runCommand; runtime guard in `runContractTestCommand` (after the npm-test-- guard, so existing npm-scope copy wins) is the enforcement boundary because matrix row substitution happens post-parse.
- Error copy distinct from #254 (`evidence command contains …`): `Contract testCommand contains forbidden shell metacharacters: …` at parse, `Contract testCommand refused before spawn: …` at verify.
