# SP-536: Status

**Current Step:** Step 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-07
**Review Level:** see PROMPT
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read SP-390 auto-approve safety and sequence CLI from SP-388
- [x] Confirm SP-535 manifest example lists release scope waves

### Step 1: Release profile
**Status:** ✅ Complete

- [x] Add release profile constants: max wave size, gate-only pause points, dry-run flag support
- [x] `spine run sequence <scope> --dry-run` prints wave plan without starting batches
- [x] Document `--auto-approve-gate` guardrails in doctor/sequence-safety

### Step 2: Tests
**Status:** ✅ Complete

- [x] `tests/batch/sequence-release-profile.test.mjs`: dry-run wave plan; auto-approve safety check

### Step 3: Testing & Verification
**Status:** 🔄 In Progress

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Cross-link `docs/release/manifest-v1.10.0-example.md`
- [ ] Create `.DONE`

---

## Completion Criteria

- [x] `spine run sequence` supports release profile with dry-run and gate-only loop
- [x] Auto-approve gate safety validated for release scope

---

## Blockers

*None*
