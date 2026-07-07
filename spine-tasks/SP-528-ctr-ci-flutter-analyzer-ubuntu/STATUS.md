# SP-528: CI flutter analyzer ubuntu fix — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-07
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read #174 CI failure logs — ubuntu-latest lacks Flutter SDK; `verifyContract` integration test failed `result.ok !== true`
- [x] Confirm existing flutter stub pattern in test file (`installFlutterStubOnPath`)

### Step 1: CI hygiene fix
**Status:** 🔄 In Progress

- [x] Ensure integration tests use flutter stub on CI (no SDK required) — hardened stub shebang + cleanup
- [x] ci.yml matrix unchanged — test-level stub sufficient; CI green since `1c5e0af4`

### Step 2: Tests
**Status:** ⬜ Not Started

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

---

## Discoveries

| Date | Finding | Action |
|------|---------|--------|
| 2026-07-07 | Core fix pre-landed on `main` as `1c5e0af4` before batch; SP-528 formalizes FR-STA-13 closure | Harden stub + close #174 |

---

## Blockers

*None*
