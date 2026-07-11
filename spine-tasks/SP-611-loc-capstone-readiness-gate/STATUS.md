# SP-611: LOC capstone readiness gate — Status

**Current Step:** Step 2: Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Capstone detection rule chosen
- [x] Policy evaluation approach chosen

### Step 1: Readiness gate

**Status:** ✅ Complete

- [x] Preflight/planner gate implemented
- [x] Actionable over-limit module list in error

### Step 2: Testing & Verification

**Status:** 🟡 In Progress

- [x] `tests/config/loc-capstone-readiness.test.mjs` added
- [x] Contract testCommand green
- [ ] Full suite + coverage gate

### Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

### Step 0 plan (Review Level 1)

**Detection (empty-grandfather / LOC-capstone):**
- Treat as capstone when PROMPT/title/folder shows emptying intent for `PHASE23_GRANDFATHERED_OVER_500` (e.g. "Empty PHASE23…", "Remove all entries from PHASE23…", folder `*grandfather*empty*`), or File Scope touches `bin/spine-cli/verify.mjs` with emptying + grandfather markers.
- Exclude readiness-gate / "must not schedule" packets (SP-611 itself).

**Policy evaluation (no list mutation):**
- Shared LOC scan in `src/config/preflight/loc-capstone.mjs`; evaluate `batch-loc-policy` as if grandfather list were `[]`.
- If any `src/batch/*.mjs` still >500, block with actionable module list.
- Fail-closed check in preflight (`checkLocCapstoneReadiness`) + planner (`assertLocCapstoneReadinessForPlan` via `buildPlan`).

**GitNexus:** `runBatchPreflight` upstream impact HIGH (batch start/sequence) — additive check only; normal pending scopes unchanged when no LOC-capstone or policy already green.

### Step 1

- Added `src/config/preflight/loc-capstone.mjs`
- Wired into `runBatchPreflight` and `buildPlan`
- `bin/spine-cli/verify.mjs` reuses shared `evaluateBatchLocPolicy` (grandfather list remains `[]`)

### Step 2

- Contract: `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/config/loc-capstone-readiness.test.mjs` → 9/9 pass
