# SP-605: Extract salvage-batch-integrate.mjs — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-591 complete (`.DONE` present; list extract landed)

### Step 1: Complete split
**Status:** 🔄 In Progress
- [x] Move remainder; thin `salvage-batch.mjs` ≤500 LOC
- [x] Preserve all public exports via re-export

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] `node --test tests/batch/batch-salvage-integrate.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Notes

### Plan (Review Level 1)

1. Create `src/batch/salvage-batch-integrate.mjs` with `confirmSalvageIntegrate`, `integrateSalvageableLane`, `formatSalvageIntegrateOutput`.
2. Thin `salvage-batch.mjs` to re-export list + integrate APIs.
3. Update `salvage-batch-list.mjs` header comment (SP-605 complete).
4. Delivery proof: new `salvage-batch-integrate.mjs` per `fileScopeMustChange` amendment.

### Discoveries

| Finding | Action |
|---------|--------|
| SP-591 `.DONE` present; list already extracted | Proceed with integrate half |
| `salvage-batch.mjs` already 417 LOC (≤500) but still holds integrate | Extract anyway for split completion / delivery proof |
| GitNexus impact on `integrateSalvageableLane`: LOW (0 indexed upstream) | Callers via `salvage-batch.mjs` re-export: `bin/spine-batch.mjs`, tests |
| Plan review (step 1): skipped (real-pi nested spawn blocked) | Engine reviews after `.DONE` |
