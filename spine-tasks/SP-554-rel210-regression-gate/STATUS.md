# SP-554: v2.1.0 regression gate — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-07-09
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read SP-545 / `release-proof-gate.sh` v2.0.0 pattern
- [x] Read `docs/release/manifest-v2.1.0.md`

### Step 1: Gate script
**Status:** ✅ Complete

- [x] Add `RELEASE_MANIFEST` env or detect v2.1.0 manifest path
- [x] Check `docs/PRD-v2.1.0-backlog-drain-handoff.md` exists
- [x] Preserve v2.0.0 proof manifest check (both manifests or version flag)

### Step 2: Tests
**Status:** ✅ Complete

- [x] Extend `release-proof-gate.test.mjs` for v2.1.0 manifest path

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run contract `testCommand` (9/9 pass)
- [x] `./scripts/release-proof-gate.sh` exits 0 on clean repo (SPINE_PROOF_SKIP_GITNEXUS=1)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`
