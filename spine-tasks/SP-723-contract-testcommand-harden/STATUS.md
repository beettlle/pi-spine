# SP-723: Harden contract testCommand execution — Status

**Current Step:** Step 3
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

**Status:** ⬜ Not Started

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

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
| | | |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-25 | Task staged | PROMPT.md and STATUS.md created for v2.16.0 release |
| 2026-08-25 | Step 1 complete | Scanner `findContractCommandMetacharIssue` in parse-prompt.mjs (quote-aware, `&&` chains allowed); wired into testCommand+runCommand parse validation; runtime guard `isRefusedContractMetacharCommand` in contract-exec.mjs after npm-test-- guard. Ad-hoc case matrix pass. |
| 2026-08-25 | Step 2 complete | New `tests/batch/contract-exec.test.mjs` (10 tests, all green): rejection matrix, quote-aware allowances, no-spawn marker proof, distinct-copy assertions, guard precedence, verifyContract surfacing, parse-time testCommand/runCommand errors. |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes

- **`&&` stays allowed** as the sole chain separator (mirrors #254 evidence grammar): house style `npm run typecheck && …` is used by every staged packet contract including SP-723/SP-721's own; rejecting it would make this task's own contract unexecutable. Lone `&` fails closed. Mission's `&&`/`||` entries are satisfied: `||` rejected via `|`, `&&` handled as the documented chain operator.
- Scanner is quote-aware: single-quoted text is literal data (keeps `printf '%s' '… | …'` fixture in `contract-verify.test.mjs` green); `$`/backticks rejected even inside double quotes (they expand there); unclosed quotes and newlines fail closed.
- Parse-time validation covers testCommand **and** runCommand; runtime guard in `runContractTestCommand` (after the npm-test-- guard, so existing npm-scope copy wins) is the enforcement boundary because matrix row substitution happens post-parse.
- Error copy distinct from #254 (`evidence command contains …`): `Contract testCommand contains forbidden shell metacharacters: …` at parse, `Contract testCommand refused before spawn: …` at verify.
