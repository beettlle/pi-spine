# SP-750: Phase 1 high-risk modules remove @ts-nocheck — Status

**Current Step:** 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-749 guard exists and allowlist format — `tests/arch/ts-nocheck-guard.test.mjs`: `NOCHECK_ALLOWLIST` is a sorted `Set` of repo-relative paths; hygiene test fails on stale entries AND a count-parity test asserts `found.length === allowlist.size` (shrinking both sides stays green). Shrink = remove directive + delete entry.
- [x] Note which Phase 1 targets still have `@ts-nocheck` — `state-io.mjs`, `state-guards.mjs`, `contract-exec.mjs` carry it; `src/process/liveness.mjs` is already clean (no directive → nothing to remove; will add to batch tsconfig include for coverage).

### Plan (Review Level 2, recorded before coding)

Impact analysis (GitNexus, per AGENTS.md): `saveSpineBatchState` upstream = CRITICAL (45 direct callers) — ⚠️ mitigated because edits are typing-only (JSDoc/@ts-nocheck removal, zero runtime semantic change) and gated by full `npm test` + `tsc`. `evaluateBatchStateWriteGuard` = LOW (0), `verifyContract` = LOW (5).

1. `state-guards.mjs`: drop nocheck; retype `state` params as `Record<string, any>` where mutated/read (`evaluateBatchStateWriteGuard`, `recordBatchEnginePid`, `clearBatchEnginePid`); fix `(raw.tasks ?? []).some(...)` unknown-narrowing issue in `validateBatchState`.
2. `state-io.mjs`: drop nocheck; add `@returns` shape to `loadSpineBatchState`; retype `state` param of `saveSpineBatchState` as `Record<string, any>`.
3. `contract-exec.mjs`: drop nocheck; add `ContractTestCommandResult` + `VerifyContractConfig` typedefs; fix `result.error?.code` via `NodeJS.ErrnoException` cast; fix post-loop `lastResult` nullable use (loop always runs ≥1 attempt — cast with comment); merge stray duplicated `/**` opener above `runContractTestCommand`.
4. `tsconfig.batch.json`: add the 4 Phase-1 files to include. Transitive checked files (`fs/atomic-write.mjs`, `process/liveness.mjs`, `scripts/coverage-parse.mjs`) will surface errors → minimal JSDoc fixes (liveness is in File Scope; others are imports logically required).
5. `tests/arch/ts-nocheck-guard.test.mjs`: remove the 3 allowlist entries (count-parity keeps green at 168/168).
6. Real-pi session (`SPINE_WORKER_RUNNER` set) → no in-worker review spawns; engine reviews after `.DONE`.

### Discoveries

| Finding | Handling |
|---------|----------|
| `contract-exec.mjs` has a stray unclosed `/**` JSDoc opener before `runContractTestCommand` (parses as one merged comment) | Merged into one proper JSDoc while typing |
| `contract-exec.mjs` imports untyped `micromatch` (no bundled types, no `@types` installed); `maxNodeModuleJsDepth: 0` causes TS7016 | Added minimal ambient `types/micromatch.d.ts` (isMatch only), included by `tsconfig.batch.json` |
| `parseContract` (parse-prompt.mjs, nocheck) has full `@returns` typedef → `ReturnType<>` in contract-exec resolves to real shape, giving strict checks | Kept existing `ReturnType<...>` JSDoc reference |
| SP-611 `BATCH_MODULE_LOC_LIMIT` (500, policy = wc-l+1) caps `src/batch/*.mjs`; original contract-exec was 497 wc → only ~2 lines of typing headroom | Typing compressed to net +1 line (498 wc / 499 policy): inline casts, 1-line `@param`-merged comments; no grandfather-list growth |
| Worker-session env (`SPINE_IS_WORKER`, `SPINE_WORKER_RUNNER`) leaks into nested test subprocesses and fails ~45 batch-start/sequence tests via SP-482 guard | Full-suite verification run with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER -u SPINE_WORKER_PI_TIMEOUT_MS`; documented for future workers |
| Lane worktree has no `node_modules` (resolves via parent repo) — base-commit comparison worktree needs a symlink to the parent repo's node_modules | Used for pre-existing-failure diagnosis; temp worktree removed after |

---

### Step 1: Type Phase 1 modules + expand batch tsconfig
**Status:** ✅ Complete

- [x] Remove `@ts-nocheck` from Phase 1 targets; add JSDoc as needed — `state-guards.mjs` (Record<string, any> state params; `raw.tasks` cast in lane loop), `state-io.mjs` (`loadSpineBatchState` @returns shape; Record state), `contract-exec.mjs` (`ContractTestCommandResult` + `VerifyContractConfig` typedefs; ErrnoException cast; post-loop finalResult cast; fixed stray duplicated `/**`; stack.pop() narrowing; typed indexAndWorktreeFiles). `liveness.mjs` already clean — typed transitively clean.
- [x] Expand `tsconfig.batch.json` `include` — +3 target modules, + `src/process/liveness.mjs`, + `types/micromatch.d.ts` (ambient decl for untyped micromatch; TS7016; @types not installed and package.json out of scope)
- [x] Shrink arch allowlist for cleaned files — removed `contract-exec.mjs`, `state-guards.mjs`, `state-io.mjs` (171 → 168 entries)
- [x] Keep engine-lanes / reconcile nocheck untouched — confirmed, only 3 allowlist entries removed

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint` — clean (0 warnings, `--max-warnings 0`)
- [x] Run Contract `testCommand` — PASS end-to-end (lint → typecheck → tsc batch → arch guard 4/4), re-run after final edits
- [x] Fix all failures — (1) LOC cap: contract-exec.mjs hit 531 policy LOC vs `BATCH_MODULE_LOC_LIMIT` 500 (`runPhase23ExitVerify` structural check); compacted typing to net-negative line count (498 wc / 499 policy vs original 497/498), no grandfather-list growth. (2) Mass test failures diagnosed as environmental: worker-session env vars (`SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER`) inherited into nested test subprocesses trigger the SP-482 nested-batch-spawn guard; suite passes with those unset (confirmed: engine.test.mjs 3/12 → 12/12)
- [x] Spot-check related batch tests — full `npm test` clean-env: **2582/2582 pass, 0 fail** (incl. pretest fixtures); base-commit comparison confirmed the only pre-run failure set was env-induced, not SP-750 regression

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Update #266 checklist / follow-up notes — burn-down comment posted (264 files, 168 nocheck → **36.3% checkJs-clean**; tsconfig include 4 → 8); follow-up issues filed: Phase 2 → [#283](https://github.com/beettlle/pi-spine/issues/283) (engine-lanes), Phase 3 → [#284](https://github.com/beettlle/pi-spine/issues/284) (reconcile/doctor); cross-link comment posted. Commit convention intentionally omits "Closes #266" keyword so the issue stays open while rows remain.
- [x] Create `.DONE` — after all completion criteria verified

---

## Completion Criteria

- [x] Phase 1 modules pass `tsc --project tsconfig.batch.json` without nocheck (state-io, state-guards, contract-exec; liveness clean + included)
- [x] `tsconfig.batch.json` include expanded for Phase 1 (4 → 8 entries)
- [x] Arch guard green; allowlist shrunk 171 → 168 (hygiene + count-parity tests pass)
- [x] No regression: lint clean, typecheck clean, Contract `testCommand` PASS, full `npm test` 2582/2582
- [x] #266 updated (burn-down comment + Phase 2/3 follow-ups #283, #284)
- [x] `.DONE` created

**End state:** 3 source modules typed (nocheck removed, typing-only edits), `tsconfig.batch.json` + ambient `types/micromatch.d.ts` added, arch allowlist shrunk by 3. PROMPT.md left pristine per SP-749 convention (STATUS is the tracker).
