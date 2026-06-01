# General — Context

**Last Updated:** 2026-05-31
**Status:** Active
**Next Task ID:** TP-009

---

## Current State

Phase 0 complete — batch `20260531T165700` merged to `main` (TP-002–TP-005). TP-002 finished manually after two Taskplane stall kills; see post-mortem.

| Task | Summary | Status |
|------|---------|--------|
| TP-002 | Implement `spine init` + templates | Done (manual completion after stall) |
| TP-003 | Minimal GitHub Actions CI | Done |
| TP-004 | Pi slash command stubs (§15.1) | Done |
| TP-005 | Taskplane testing config + agent overrides | Done |

### Phase 1 — Compat + planner (staged)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-006 | Batch preflight (FR-BATCH-11) | Staged | — |
| TP-007 | Taskplane parsers (FR-TASK-01–05) | Staged | — |
| TP-008 | Planner + `spine plan` / `/spine-plan` (FR-SCHED-01–04,06) | Staged | TP-006, TP-007 |

---

## Revised execution plan (do not repeat 20260531 failure)

### Policy (PRD §23.1)

1. **Preflight before any batch:** `spine doctor`, clean git status, task packets committed.
2. **No `/orch all` on greenfield** until CI exists and largest task has completed once serially.
3. **Serial first** for bootstrap work; parallelize only with proven disjoint scopes.
4. **Recovery literacy:** retry must reset task **and** segment frontier (see incident I-02).

### `/orch` wave plan (Phase 1 dogfood)

Run with **max 2 lanes** until pi-spine engine replaces Taskplane:

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | TP-006 ∥ TP-007 | Disjoint file scopes — preflight vs parsers |
| 1 | TP-008 | Depends on TP-006 + TP-007; completes FR-BATCH-11 wave plan |

Preflight policy: run `spine doctor` (or Taskplane equivalent) before wave 0; commit task packets before batch start.

### Next steps

1. **Execute Phase 1** using the wave plan above (2-lane max for wave 0).
2. Replace Taskplane `/orch` for dogfood as soon as `/spine-retry-task` exists (Phase 3).

### What pi-spine must fix (priority order)

| Priority | Requirement | Phase |
|----------|-------------|-------|
| P0 | Batch preflight (FR-BATCH-11) | 1 (TP-006 + TP-008) |
| P1 | Atomic task+segment retry (§18.5) | 3 |
| P1 | Progress-aware stall detection (§18.4) | 3 |
| P1 | Abort archive + segment-safe rebuild (§18.6) | 3 |
| P2 | Mixed-outcome merge block (§17.4) | 3 |
| P2 | Honest post-mortem (NFR-OBS-03) | 4 |

Testing commands in `.pi/taskplane-config.json`:
- **unit:** `npm run typecheck && npm test`
- **build:** `npm run typecheck && npm test`

Use `npm test` for full verification once the test script exists in `package.json`; typecheck alone is insufficient for planner/preflight tasks.

---

## Key Files

| Category | Path |
|----------|------|
| Tasks | `taskplane-tasks/` |
| Config | `.pi/taskplane-config.json` |
| PRD | `pi-spine-PRD.md` (v1.1 — incident updates) |
| Incident report | `docs/incidents/20260531-phase0-taskplane-batch.md` |
| Taskplane gaps | `docs/compatibility/taskplane-gap-list.md` |
| Package | `package.json`, `bin/spine.mjs` |

---

## Technical Debt / Future Work

- FR-INIT-05 `spine init --preset taskplane-compat` (Phase 1)
- Batch engine, journal (Phases 2–3) — **recovery tooling is now P1, not nice-to-have**
- Do not run Taskplane and pi-spine batches concurrently (PRD §22.1)
- Replace Taskplane `/orch` for dogfood as soon as `/spine-retry-task` exists (Phase 3)
