# SP-591: Split salvage-batch.mjs — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for salvage-batch.mjs
- [x] List public exports to preserve

### Step 1: Create extracted module(s)
**Status:** ✅ Complete

- [x] Create `salvage-batch-list.mjs` ≤500 LOC (`listSalvageableLanes`, `formatSalvageListOutput`, `isNonSalvageableExitReason`)

### Step 2: Re-export
**Status:** ✅ Complete

- [x] Re-export list API from `salvage-batch.mjs` (integrate left for SP-605)

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] `node --test tests/batch/batch-salvage-list.test.mjs` — 7/7 pass
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — typecheck clean; suite 1953/1954 then flaky stall re-run 7/7; salvage list+integrate 14/14

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Explore: `salvage-batch.mjs` (691 LOC) → list + integrate; this task is list half only
- Do NOT edit `bin/spine-cli/verify.mjs` (SP-593 grandfather)
- Extract: `salvage-batch-list.mjs` 291 LOC; `salvage-batch.mjs` 417 LOC (still >500 until SP-605)

### Plan (Review Level 1)

1. Create `src/batch/salvage-batch-list.mjs` with list helpers + `NON_SALVAGEABLE_EXIT_REASONS`, `isNonSalvageableExitReason`, `listSalvageableLanes`, `formatSalvageListOutput`.
2. Thin `salvage-batch.mjs`: re-export list API; keep integrate path importing `listSalvageableLanes` from the new module.
3. Preserve public surface for `bin/spine-batch.mjs` and tests (no import path changes required).
4. No runtime behavior change; integrate deferred to SP-605.

### Public exports to preserve (via re-export)

| Export | Destination |
|--------|-------------|
| `NON_SALVAGEABLE_EXIT_REASONS` | list module |
| `isNonSalvageableExitReason` | list module |
| `listSalvageableLanes` | list module |
| `formatSalvageListOutput` | list module |
| `confirmSalvageIntegrate` | stays in salvage-batch.mjs |
| `integrateSalvageableLane` | stays in salvage-batch.mjs |
| `formatSalvageIntegrateOutput` | stays in salvage-batch.mjs |

## Discoveries

| Finding | Action |
|---------|--------|
| GitNexus impact: symbols not in index (stale) | Proceed via grep callers: `bin/spine-batch.mjs`, tests, integrate path |
| STATUS had generic Pending checkboxes vs PROMPT | Hydrated to PROMPT outcomes within existing step numbers |
| Contract testCommand: 7/7 pass | Evidence recorded Step 3 |
| Full `npm test` under `SPINE_IS_WORKER=1` fails nested-batch tests | Re-ran with `env -u SPINE_IS_WORKER -u SPINE_PARENT_BATCH_ID` |
| 1 flake: contract stall override under load | Re-ran `contract-stall-override.test.mjs` → 7/7 pass; unrelated to extract |
