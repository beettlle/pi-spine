# SP-567: v2.2.0 regression gate — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-09
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read SP-554 pattern
- [x] Read `docs/release/manifest-v2.2.0.md`

**Plan (Review Level 1):**
- Default `RELEASE_GATE_VERSION` → `2.2.0`
- Add `manifest-v2.2.0.md` + `PRD-v2.2.0-backlog-drain-handoff.md` paths
- Version-aware handoff PRD check (2.1.0 vs 2.2.0)
- Preserve 2.0.0 / 2.1.0 / both manifest branches unchanged

### Step 1: Gate script
**Status:** 🔄 In Progress

- [ ] v2.2.0 manifest + handoff checks

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Extend release-proof-gate tests

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run contract testCommand

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`
