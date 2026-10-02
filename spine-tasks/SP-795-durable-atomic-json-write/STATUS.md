# SP-795: Durable writeJsonAtomic — Status

**Current Step:** Step 2
**Status:** 🟨 In Progress
**Last Updated:** 2026-10-02
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Callers noted
- [x] Dependencies satisfied

### Step 1: Durable write
**Status:** ✅ Complete

- [x] File + directory fsync
- [x] Narrow error tolerance
- [x] Signature unchanged

### Step 2: Tests
**Status:** 🟨 In Progress

- [ ] Call-order test
- [ ] Directory `EPERM`
- [ ] File fsync error

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Full suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `rg` preflight: `writeJsonAtomic` has 13 call sites in 12 modules; `writeTextAtomic` is the shared impl and also serves worker logs and gate evidence directly. |
| 2 | GitNexus impact on `writeTextAtomic` (upstream, depth 2): **CRITICAL** — 6 direct callers, 24 impacted symbols, 8 processes (engine lanes, salvage, gates, evidence). Mitigation: signature, temp naming, and cleanup-on-error unchanged; file-fsync errors keep propagating; gated by contract testCommand + full suite + coverage. |

## Blockers

_None._
