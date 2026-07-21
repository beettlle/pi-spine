# SP-681: Optional quota provider probes — Status

**Current Step:** Complete
**Status:** ✅ Done
**Last Updated:** 2026-07-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Snapshot extension points confirmed
- [x] List degrade modes (`live` | `estimate` | `absent`)

### Step 1: Probe adapters
**Status:** ✅ Complete

- [x] Fail-closed adapters + mocked tests

### Step 2: Snapshot integration
**Status:** ✅ Complete

- [x] Source modes merged; secrets redacted

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Scoped contract passing

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] `.DONE` created

## Notes

Plan review skipped (worker session; batch engine runs review after .DONE per SP-195).
- Implemented `src/metrics/quota-probes.mjs` with fail-closed optional adapters for zai, kimi-coding, and cursor (admin-only).
- Extended `src/metrics/quota-snapshot.mjs` to accept `probeResults` and merge `live` source/usage/limit while falling back to `estimate`/`absent`.
- Added `tests/metrics/quota-probes.test.mjs` with mocked fetch fixtures; no live network required.
- Verified with `npm run typecheck` and scoped contract test command.
