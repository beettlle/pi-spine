# SP-605: Extract salvage-batch-integrate.mjs — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-12
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-591 complete (`.DONE` present; list extract landed)

### Step 1: Complete split
**Status:** ✅ Complete
- [x] Move remainder; thin `salvage-batch.mjs` ≤500 LOC (18 LOC shim)
- [x] Preserve all public exports via re-export

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] `node --test tests/batch/batch-salvage-integrate.test.mjs` — 9/9 pass
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — typecheck clean; 1985/1985 pass (`env -u SPINE_IS_WORKER -u SPINE_PARENT_BATCH_ID`)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create `.DONE`

## Completion Criteria

- [x] `salvage-batch.mjs` ≤500 LOC (18); API unchanged via re-export

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
| GitNexus impact on `integrateSalvageableLane`: LOW | Callers via `salvage-batch.mjs` re-export: `bin/spine-batch.mjs`, tests |
| Plan review (step 1): skipped (real-pi nested spawn blocked) | Engine reviews after `.DONE` |
| Full `npm test` under `SPINE_IS_WORKER=1` fails nested-batch tests | Re-ran with `env -u SPINE_IS_WORKER -u SPINE_PARENT_BATCH_ID SPINE_WORKER_STUB=1` |

### Deliverables

| Path | LOC | Role |
|------|-----|------|
| `src/batch/salvage-batch-integrate.mjs` | 410 | integrate + confirm + formatters |
| `src/batch/salvage-batch.mjs` | 18 | thin re-export shim |
| `src/batch/salvage-batch-list.mjs` | 324 | list API (SP-591; comment updated) |
