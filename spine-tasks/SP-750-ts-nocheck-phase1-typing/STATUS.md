# SP-750: Phase 1 high-risk modules remove @ts-nocheck — Status

**Current Step:** 2
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
| `contract-exec.mjs` has a stray unclosed `/**` JSDoc opener before `runContractTestCommand` (parses as one merged comment) | Merge into one proper JSDoc while typing |
| `contract-exec.mjs` imports untyped `micromatch` (no bundled types, no `@types` installed); `maxNodeModuleJsDepth: 0` may cause TS7016 | Resolve via evidence during tsc run; prefer local ambient `declare module` if needed |
| `parseContract` (parse-prompt.mjs, nocheck) has full `@returns` typedef → `ReturnType<>` in contract-exec resolves to real shape, giving strict checks | Keep existing `ReturnType<...>` JSDoc reference |

---

### Step 1: Type Phase 1 modules + expand batch tsconfig
**Status:** ✅ Complete

- [x] Remove `@ts-nocheck` from Phase 1 targets; add JSDoc as needed — `state-guards.mjs` (Record<string, any> state params; `raw.tasks` cast in lane loop), `state-io.mjs` (`loadSpineBatchState` @returns shape; Record state), `contract-exec.mjs` (`ContractTestCommandResult` + `VerifyContractConfig` typedefs; ErrnoException cast; post-loop finalResult cast; fixed stray duplicated `/**`; stack.pop() narrowing; typed indexAndWorktreeFiles). `liveness.mjs` already clean — typed transitively clean.
- [x] Expand `tsconfig.batch.json` `include` — +3 target modules, + `src/process/liveness.mjs`, + `types/micromatch.d.ts` (ambient decl for untyped micromatch; TS7016; @types not installed and package.json out of scope)
- [x] Shrink arch allowlist for cleaned files — removed `contract-exec.mjs`, `state-guards.mjs`, `state-io.mjs` (171 → 168 entries)
- [x] Keep engine-lanes / reconcile nocheck untouched — confirmed, only 3 allowlist entries removed

---

### Step 2: Testing & Verification
**Status:** ⚪ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Update #266 checklist / follow-up notes
- [ ] Create `.DONE`
