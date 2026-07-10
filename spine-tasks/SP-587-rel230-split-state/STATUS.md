# SP-587: Split state.mjs — Status

**Current Step:** Step 0
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** 🔄 In Progress

- [x] Read explore findings for state.mjs
- [x] Confirm dependencies satisfied (SP-578 reconcile split merged on branch)
- [x] Identify public exports to preserve via re-export

### Step 1: Create extracted module(s)
**Status:** ⬜ Not Started

- [ ] Create `src/batch/state-io.mjs` and `src/batch/state-guards.mjs`
- [ ] Move implementations per handoff: read/write/archive → state-io; write guard + PID + schema → state-guards
- [ ] Keep each new file ≤500 LOC

### Step 2: Re-export
**Status:** ⬜ Not Started

- [ ] Remove moved code from `src/batch/state.mjs`
- [ ] Re-export public symbols from new module(s)
- [ ] Remove `src/batch/state.mjs` from `PHASE23_GRANDFATHERED_OVER_500`

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run targeted test: `node --test tests/batch/reconcile.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify `src/batch/state.mjs` ≤500 LOC

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Log discoveries in STATUS.md
- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Split plan: state-io (read/write/archive/history), state-guards (write guard, PID, schema validation), state.mjs shim (orchestration + re-exports)
- Cycle break: state-guards uses local path helpers; state-io imports guards only

## Discoveries

| Finding | Impact |
|---------|--------|
| SP-578 reconcile split present on branch (reconcile-classify/diagnosis) | Dependency satisfied |
| `batch-state-io.mjs` already exists (legacy taskplane reader) — new module is `state-io.mjs` | No naming conflict |
