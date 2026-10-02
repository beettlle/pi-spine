# SP-795: Durable writeJsonAtomic — Status

**Current Step:** Step 4
**Status:** 🟩 Verifying/Delivering
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
**Status:** ✅ Complete

- [x] Call-order test
- [x] Directory `EPERM`
- [x] File fsync error

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Lint
- [x] Contract `testCommand`
- [x] Full suite
- [x] Coverage gate
- [x] Fix all failures

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
| 3 | `tests/batch/state-transition.test.mjs` (outside File Scope, minimal logically-required fix): its "atomic write fails" scenario mocked `fs.writeFileSync` on `.tmp` paths; the durable path no longer calls it, so the mock never fired. Moved the simulated failure to `fs.writeSync`. Intent preserved (prior JSON intact, error propagates, no temp leftover). Only test file in the repo with this stale mock pattern (verified by rg). |
| 4 | `npm run coverage:check` inside a worker session fails 44 engine-subprocess tests with `nested_batch_spawn_blocked` because `run-coverage.mjs` inherits `SPINE_IS_WORKER=1` (SP-482 guard works as designed). With `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER npm run coverage:check`: 2751/2751 pass, 90.09% ≥ 77% threshold. Pre-existing environmental behavior, not caused by this task. |
| 5 | Verification evidence: lint + typecheck clean; contract testCommand 18/18; full suite `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test` → 2751 pass / 0 fail, exit 0. |

## Blockers

_None._
