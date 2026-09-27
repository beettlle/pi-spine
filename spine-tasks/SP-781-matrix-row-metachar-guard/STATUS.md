# SP-781: Matrix row runtime metachar guard — Status

**Current Step:** Complete
**Status:** ✅ Done (.DONE created)
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Reproduce injection at HEAD — row value `alpha; printf PWNED > pwned.txt` substitutes into runCommand; `/bin/sh -c` runs the injected second command (pwned.txt created); `isRefusedContractMetacharCommand(substituted)` = true
- [x] Dependencies satisfied (none)

### Step 1: Runtime guard
**Status:** ✅ Done

- [x] Guard after substitution, before spawn — `isRefusedContractMetacharCommand(command)` ternary short-circuits before `runShellInDir` (matrix-run.mjs execute branch)
- [x] Refused-row result + message — flows through the existing `run.exitCode !== 0` failed-row path; `formatMatrixRowRefusedMetacharMessage` names row id + detected issue ("matrix row command refused before spawn")
- [x] `&&` allowed — same #268 grammar; unit + e2e assertions
- [x] Injection tests (no spawn, journaled) — matrix-row-command-guard.test.mjs: `;`, `$(`, backtick, lone `&` all refused; `pwned.txt`/`out/` absent in row worktree; `matrix.sub_lane.failed` journaled
- [x] `contract-matrix-subst` case — metachar-in-value: substitution textual, verifyContract refuses before spawn

### Step 2: Testing & Verification
**Status:** ✅ Done

- [x] Lint — `npm run lint` clean (exit 0, 0 warnings)
- [x] Contract `testCommand` — `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test …` → 63/63 pass, 0 fail (lint + both tsconfigs clean; matrix-execution e2e suite green)
- [x] Fix all failures — none surfaced

### Step 3: Documentation & Delivery
**Status:** ✅ Done

- [x] Discoveries logged (see table)
- [x] Create `.DONE`

---

## Discoveries

| # | Discovery |
|---|-----------|
| 1 | Step 0 repro: `substituteRowCommand` + `/bin/sh -c` at HEAD ran the injected second command (`pwned.txt` created); `isRefusedContractMetacharCommand(substituted)` = true, confirming post-substitution guard placement closes the hole. |
| 2 | `runContractTestCommand` checks `NPM_TEST_DASH_DASH_RE` **before** the metachar guard, so `npm test -- a; printf PWNED` would hit the npm-test refusal first — the contract-matrix-subst test uses a `node scripts/run.js {matrix.run_id}` testCommand to pin the #297 metachar refusal specifically. |
| 3 | `CONTRACT_TEST_RETRY_DELAY_MS` = 5000 ms; verifyContract-based tests pass `contract: { testRetries: 0 }` to skip retry sleeps on refusal. |
| 4 | `gitnexus detect_changes` flags `serveMatrixRowPrompt` as "touched" — line-offset heuristic from inserting the formatter above it; function body unchanged (verified via diff). Only `runMatrixSubLane` actually modified in src. |
| 5 | `docs/adoption/operator-runbook.md` §2.4 substitution rules do not yet mention the #297 runtime refusal — **affected, deferred to SP-789** per PROMPT (Must Update: None). |

## Blockers

_None._
