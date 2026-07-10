# SP-600: Extract sequence-run.mjs — Status

**Current Step:** Step 3
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-582 complete (lane-1 `.DONE` + `sequence-plan.mjs`; brought into this worktree)

### Step 1: Extract / complete split
**Status:** ✅ Complete
- [x] Move remainder; thin `sequence.mjs` ≤500 LOC (27 LOC facade)
- [x] Preserve all public exports via re-export

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] `node --test tests/batch/sequence-release-profile.test.mjs` (11/11 pass)
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (typecheck ok; 1952/1954 — see Discoveries)

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress
- [ ] Create `.DONE`

## Discoveries

| Finding | Action |
|---------|--------|
| SP-582 not merged into lane-2 base; complete in lane-1 | Brought `sequence-plan.mjs` + thinned `sequence.mjs` from SP-582 commit |
| `sequence-run.mjs` alone was 566 LOC (>500 policy) | Split wait/land into `sequence-wait.mjs` (167); run=418 |
| `review-step.mjs` (797) fails phase23 LOC (pre-existing SP-597); cannot edit `verify.mjs` | Out of scope — 2 npm test failures unrelated to this split |

## Notes

- LOC: sequence.mjs=27, sequence-plan.mjs=234, sequence-run.mjs=418, sequence-wait.mjs=167
- Public API preserved via re-exports from `sequence.mjs`
