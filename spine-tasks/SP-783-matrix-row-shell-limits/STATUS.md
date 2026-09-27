# SP-783: Matrix row shell timeout and output cap — Status

**Current Step:** Complete
**Status:** ✅ Done — all completion criteria met
**Last Updated:** 2026-09-27
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Confirm no timeout/cap; list callers
- [x] Dependencies satisfied

### Step 1: Timeout + output cap
**Status:** ✅ Done

- [x] Options + named-constant defaults
- [x] Env override
- [x] Tree kill on timeout (124, `timedOut`)
- [x] Tail buffer + marker
- [x] Timer cleanup

### Step 2: Tests
**Status:** ✅ Done

- [x] Timeout kills grandchild
- [x] Output cap
- [x] Env override
- [x] Existing tests green

### Step 3: Testing & Verification
**Status:** ✅ Done

- [x] Lint
- [x] Contract `testCommand`
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Done

- [x] Discoveries logged
- [x] Create `.DONE`

---

## Plan (Review Level 1)

- `matrix.mjs`: add `DEFAULT_MATRIX_ROW_TIMEOUT_MS = 600_000`, `DEFAULT_MATRIX_ROW_OUTPUT_MAX_BYTES = 262_144`, `resolveMatrixRowTimeoutOverride()` (reads `SPINE_MATRIX_ROW_TIMEOUT_MS`, positive-integer-valid else null, mirrors `SPINE_SYNC_TIMEOUT_MS`).
- `runShellInDir(cwd, command, extraEnv = null, options = {})`: `options.timeoutMs` (valid option > env override > default) and `options.maxOutputBytes` (valid option > default).
- Spawn `detached: true` (POSIX) → shell is process-group leader so `terminateProcessTree` reaches grandchildren via `-pid` group kill + pgrep walk.
- Timeout: `setTimeout` → `terminateProcessTree(pid, { signal: "SIGTERM" })` → SIGKILL escalation after 5s grace if still open; resolve `exitCode: 124`, `timedOut: true`, message `matrix row command timed out after <N>ms` appended to output. `clearTimeout` both timers in a `settle()` guard (close + error paths).
- Output cap: front-dropping chunk tail buffer in byte space (`Buffer` ops, `Buffer.from` copy on shrink so memory is strictly O(cap)); on drop, prefix `[… N bytes truncated …]\n` and set `outputTruncated: true`.
- New tests: `tests/batch/matrix-row-shell-limits.test.mjs` — tree-kill (distinctive `sleep 97` grandchild, `pgrep -f` poll to confirm death), cap bounds `output.length ≤ cap + marker`, env override (resolver unit + integration via `sleep`), defaults constants.

## Discoveries

- Impact analysis (GitNexus): `runShellInDir` upstream = LOW (0 graph impacts); callers found via rg: `engine-lanes.mjs:85` (re-export), `matrix-run.mjs:280` (3-arg, non-zero exit = failed row — compatible), `matrix-execution.test.mjs` 4 call sites (no options). Return-shape additions are additive → back-compat.
- Contract path precedent confirmed: `contract-exec.mjs:176` uses `timeout: 10 * 60 * 1000` and `maxBuffer`; env-override precedent: `integrate-worktree.mjs:294` (`SPINE_SYNC_TIMEOUT_MS`, valid `Number` > 0 else default).
- `matrix-execution.test.mjs` has `// @ts-nocheck`; `matrix.mjs` does not → new JSDoc must pass `tsc --noEmit` (use locals for `Number(options.timeoutMs)` narrowing).
- `process.env.K = undefined` stores the string `"undefined"` (Node coerces), so the env-save/restore helper uses delete-or-restore explicitly; the outer `withEnvKey(undefined, …)` leaves `"undefined"` behind during the test body — harmless here because the resolver rejects it, but worth knowing for future env tests.
- Level-1 plan checkpoint: `spine_review_step --step 1 --type plan` returned `skipped: true` (nested spawn blocked in pi worker sessions, SP-195) — engine runs plan/code/final review after `.DONE`.
- `docs/adoption/operator-runbook.md` §2.4 checked: nothing it states becomes false with bounded rows; SP-789 should add `SPINE_MATRIX_ROW_TIMEOUT_MS` to §2.4's row-environment-var table (Must Update is None, so no edit here).

## Verification Evidence

- New tests: `tests/batch/matrix-row-shell-limits.test.mjs` — 6/6 pass (tree-kill reports 124 + grandchild `sleep 97` confirmed dead via `pgrep -f` poll; 400 000-byte stream capped at 1024-byte tail + `[… N bytes truncated …]` marker + `outputTruncated`; invalid `maxOutputBytes` falls back to 262 144; env override 500ms kills `sleep 96` with `timed out after 500ms` message; resolver rejects `""/abc/0/-5/12.5/1e-3`).
- Contract `testCommand` (with `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` unset): lint ✓, typecheck ✓, `node --test` 48/48 pass (6 new + 42 existing `matrix-execution.test.mjs`).
- Full `npm test`: **2678/2678 pass, 0 fail** (182.7s).
- Commits: `5165301b` Steps 1–2; Step 3–4 STATUS commit follows.

## Blockers

_None._
