# SP-856: Integrate and batch complete tell the operator to wait while the engine finishes its land loop — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-11-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `reloadStateForTerminalWrite`, `formatLifecycleHuman`, and the integrate result builder; report the blast radius in STATUS
- [ ] `rg -n "batch_state_changed_during_terminal_write|suggestedCommand: \"spine batch complete\"" tests/` — list assertions that change

### Step 1: Complete refusal + headline
**Status:** ⬜ Not Started

- [ ] Live-engine active-phase refusal returns `engine_finishing_land_loop`, `pending: true`, wait suggestion
- [ ] `formatLifecycleHuman` prints `Batch lifecycle pending` for pending results

### Step 2: Integrate suggestion
**Status:** ⬜ Not Started

- [ ] Live engine in an active phase → `spine wait --until completed --timeout 10m`, `spine batch complete` in alternatives

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Complete with live / dead engine PID
- [ ] Integrate with live engine

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-856-integrate-live-engine-wait/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
