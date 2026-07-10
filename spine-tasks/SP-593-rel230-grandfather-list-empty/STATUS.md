# SP-593: Empty PHASE23_GRANDFATHERED_OVER_500 — Status

**Current Step:** Step 0
**Status:** 🚫 Blocked
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete (blocked outcome)

- [x] Confirm SP-578–592 complete — **NO** (see Discoveries)
- [x] Run `wc -l src/batch/*.mjs` — **9 modules >500**; not all ≤500

### Step 1: Empty grandfather list
**Status:** 🚫 Blocked

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
- **Block reason:** Cannot empty `PHASE23_GRANDFATHERED_OVER_500` while modules remain >500 LOC. Emptying the list would fail `batch-loc-policy`. File Scope forbids splitting those modules here.
- `dependencies.json` also lists SP-596–605 as deps of SP-593; several remain OPEN.
- No `.DONE` created — criteria unmet.

## Discoveries

| Finding | Action |
|---------|--------|
| OPEN deps: SP-579,580,581,583,584,585,588,591,597,598,599,600,601,602,604,605 | Re-queue SP-593 after those land |
| DONE but still >500: `sequence.mjs` 581 (SP-582 deferred run to SP-600); `reconcile-diagnosis.mjs` 1158 (SP-596 deferred further split) | Need follow-on splits before empty list |
| >500 still grandfathered: engine 556, worker-host 846, detached-start 908, review 1224, journal-rebuild 740, lane-dirty-check 750, salvage-batch 691 | Waiting on OPEN split tasks |
| `reconcile-diagnosis.mjs` (1159) not in grandfather list → `batch-loc-policy` already fails today | Pre-existing; out of SP-593 File Scope |
| ≤500 but still listed: reconcile 41, contract-verify 39, attached-runner 304 | Safe to drop once policy can go green |
