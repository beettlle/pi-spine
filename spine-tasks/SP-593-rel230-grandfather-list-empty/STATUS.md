# SP-593: Empty PHASE23_GRANDFATHERED_OVER_500 — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-578–592 complete — all have `.DONE`
- [x] Run `wc -l src/batch/*.mjs` — all ≤500 (max: lifecycle 498, engine 497, integrate 496)

### Step 1: Empty grandfather list
**Status:** 🔄 In Progress

- [ ] Set `PHASE23_GRANDFATHERED_OVER_500` to `[]` or borderline-only
- [ ] `batch-loc-policy` check passes

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `node --test tests/cli/phase23-exit-verify.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Real-pi worker; `spine_review_step` plan review skipped (engine post-`.DONE`)
- Prior block cleared: SP-578–592 all DONE; zero `src/batch/*.mjs` over 500 LOC
- Plan: set `PHASE23_GRANDFATHERED_OVER_500 = []` (no borderline `resume.mjs` — it is 489)

## Discoveries

| Finding | Action |
|---------|--------|
| STATUS was stale (blocked on OPEN deps / >500 modules) | Re-verified; deps DONE and LOC green |
| `batch-loc-policy` already OK with stale list (0 modules >500) | Still empty the array per Mission |
