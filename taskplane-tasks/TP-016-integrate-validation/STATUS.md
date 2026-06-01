# TP-016: Integrate validation + `spine integrate` — Status

**Current Step:** Done
**Status:** Complete
**Last Updated:** 2026-06-01
**Review Level:** 2
**Size:** M

### Step 0: Preflight — Done
- TP-015 EmptyMerge on main; preflight clean; 77/77 baseline tests

### Step 1: Integrate validation — Done
- `assertOrchIntegratable`; wired in `completeBatch`
- Reconciliation: completed phase + orch not on base → `needs_integrate`
- `suggestedCommand`: `spine integrate`

### Step 2: `spine integrate` CLI — Done
- `integrateOrchToBase`; journal `integrate.*`; `/spine-integrate`; gate stub
- `tests/batch/integrate.test.mjs`; extended `lifecycle.test.mjs`

### Step 3: Documentation — Done
- README post-batch landing runbook; CONTEXT TP-016 done

## Execution Log
| 2026-06-01 | Staged (split); run before TP-017 | packet ready |
| 2026-06-01 | Implemented TP-016 | 86 tests pass; `spine plan all` wave 8 |
