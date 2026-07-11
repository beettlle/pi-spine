# SP-608: Diagnose gate-ready headline — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Stale-headline path identified
- [x] Headline precedence mapped

### Step 1: Prefer gate-ready headline

**Status:** ✅ Complete

- [x] Gate-ready path preferred in `buildHeadline` / reconcile signals
- [x] suggestedCommand aligned when gate open

### Step 2: Testing & Verification

**Status:** 🟡 In Progress

- [x] Regression tests for #195
- [x] Contract testCommand green
- [ ] Full suite + coverage gate

### Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

### Step 0 findings (#195)

- **Stale path:** `inferMergeGitignoredFailure` scans journal `batch.merge_failed` / `task.failed` history, so it stays true after recovery.
- **Precedence bug:** `buildHeadline` / `buildSuggestedCommand` check `ctx.mergeGitignoredFailure` *before* the diagnosis switch, so `needs_integrate` never wins.
- **`mergeFailed`:** already gated to `failed` / `needs_retry` for headlines; still demote for gate-ready clarity in reconcile.
- **Plan:** Gate merge/gitignored primary messaging when diagnosis is `needs_integrate` or `allTasksTerminalSuccess` + `integrateGateOpen`; demote flags in `reconcile-batch.mjs` for headline ctx while keeping signals/history.

### Step 1 implementation

- Added `isGateReadyHeadlineContext` in `diagnosis.mjs`.
- `buildHeadline` / `buildSuggestedCommand` skip merge/gitignored primary when gate-ready.
- `reconcile-batch.mjs` demotes headline inputs when gate-ready; keeps `signals.mergeGitignoredFailure` (+ `mergeGitignoredFailureSuperseded` when verbose).

## Discoveries

| Finding | Action |
|---------|--------|
| Historical journal keeps merge_failed_gitignored after gate opens | Demote for headline; keep in signals |
| Operator runbook copy unchanged (same gate-approve strings) | No docs update |
