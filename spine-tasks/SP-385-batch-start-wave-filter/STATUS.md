# SP-385: Batch start --wave filter — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #54 Tier 1 acceptance
- [x] Read buildPlan waves shape

---

### Step 1: Wave filter
**Status:** ✅ Complete

- [x] Add wave-scope helper and CLI --wave flag parsing
- [x] Filter taskIds before startBatch; dry-run parity test

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [x] See PROMPT.md (no doc updates required)

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `resolveWaveTaskIds` already existed in `sequence.mjs`; moved to `wave-scope.mjs` with re-export | Refactored | `src/planner/wave-scope.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 0–1 | wave-scope module, CLI wiring, tests added |

---

## Blockers

*None*

---

## Notes

Plan: add `wave-scope.mjs`, wire `--wave`/`--through-wave` through `parseBatchArgs` → `startBatch`/`startBatchDetached`, filter plan via `applyBatchStartWaveFilter` before batch policy checks.
