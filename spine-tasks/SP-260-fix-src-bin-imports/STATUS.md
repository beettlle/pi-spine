# SP-260: Fix src→bin layer inversion for spine-config — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-18
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Import inventory complete — 16 files originally imported bin/* (resolved via SP-269/270/271 + final preflight fix)
- [x] No circular dependency risk — config modules import only src/**

---

### Step 1: Move config loaders to src
**Status:** ✅ Complete (SP-269)

- [x] src/config modules created (`spine-config-load.mjs`, `spine-preflight-lib.mjs`, `spine-init-constants.mjs`)
- [x] bin re-exports wired
- [x] Plan review — engine runs post-.DONE (SP-195)

---

### Step 2: Rewire src imports
**Status:** ✅ Complete

- [x] All src/** files import from src/config/* or src/doctor/* (zero bin imports)
- [x] Layer inversion test added — `tests/config/spine-config-layer.test.mjs` (no allowlist)
- [x] Code review — engine runs post-.DONE (SP-195)

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Full suite passes — `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (902 pass)
- [x] Coverage gate — `npm run coverage:check` — 86.78% line coverage (≥77%)
- [x] spine doctor smoke — `node bin/spine.mjs doctor` OK
- [x] Typecheck passes

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Zero bin imports from src confirmed
- [x] `.DONE` created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Work split to SP-269/270/271 per Amendment 1 | Completed upstream | PROMPT Amendments |
| `spine-preflight-lib.mjs` still imported bin doctor/plan | Fixed — `runDoctorChecks` moved to `src/doctor/run-doctor-checks.mjs` | Step 2 |
| Layer test had SP-270 allowlist | Removed — strict zero-import assertion | Step 2 |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-17 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-17 | Superseded | Split to SP-269, SP-270, SP-271 |
| 2026-06-18 | Step 0 | Verified SP-269/270/271 landed; 2 bin imports remained in preflight |
| 2026-06-18 | Step 2 | Extracted `runDoctorChecks` to src; rewired preflight; strict layer test |
| 2026-06-18 | Step 3 | 902 tests pass, coverage 86.78%, doctor smoke OK |
| 2026-06-18 | Step 4 | `.DONE` created |

---

## Blockers

*None*

---

## Notes

Remaining bin imports from src: **zero**. Tests and bin CLI import from `src/config/*` and `src/doctor/*`; `bin/spine-doctor.mjs` is a thin CLI re-export.
