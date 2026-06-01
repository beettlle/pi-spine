# General — Context

**Last Updated:** 2026-06-01
**Status:** Active
**Next Task ID:** TP-012

---

## Current State

Phase 0 complete — batch `20260531T165700` merged to `main` (TP-002–TP-005). TP-002 finished manually after two Taskplane stall kills; see post-mortem.

| Task | Summary | Status |
|------|---------|--------|
| TP-002 | Implement `spine init` + templates | Done (manual completion after stall) |
| TP-003 | Minimal GitHub Actions CI | Done |
| TP-004 | Pi slash command stubs (§15.1) | Done |
| TP-005 | Taskplane testing config + agent overrides | Done |

### Phase 1 — Compat + planner (on main)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-006 | Batch preflight (FR-BATCH-11) + reconciliation stub | Done | — |
| TP-007 | Taskplane parsers (FR-TASK-01–05) | Done | — |
| TP-008 | Planner + `spine plan` / `/spine-plan` (FR-SCHED-01–04,06) | Done | TP-006, TP-007 |

### Phase 1b — Batch reconciliation UX (on main)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-009 | Batch status & reconciliation CLI (FR-BATCH-12–14) | Done | TP-006 |
| TP-010 | Batch dismiss & complete lifecycle (FR-BATCH-15–18) | Done (manual recovery batch `20260601T100359`) | TP-009 |

### Phase 1c — CI hygiene (staged)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-011 | CI test fixture hardening | Done (manual recovery batch `20260601T114445`) | TP-010 |

---

## Revised execution plan (do not repeat 20260531 failure)

### Policy (PRD §23.1)

1. **Preflight before any batch:** `spine doctor`, clean git status, task packets committed.
2. **No `/orch all` on greenfield** until CI exists and largest task has completed once serially.
3. **Serial first** for bootstrap work; parallelize only with proven disjoint scopes.
4. **Recovery literacy:** retry must reset task **and** segment frontier (see incident I-02).
5. **Limbo literacy:** when all tasks succeeded but batch UI is red `stopped`, run `spine status --diagnose` — dismiss or complete; do not pause.

### `/orch` wave plan (Phase 1 + 1b dogfood)

Run with **max 2 lanes** until pi-spine engine replaces Taskplane:

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 | TP-006 ∥ TP-007 | Disjoint scopes — preflight vs parsers |
| 1 | TP-008 | Depends on TP-006 + TP-007; completes FR-BATCH-11 wave plan |
| 2 | TP-009 | Reconciliation — answers "what state am I in?" |
| 3 | TP-010 | Dismiss/complete — clears limbo before next batch |

Preflight policy: run `spine doctor` (or Taskplane equivalent) before wave 0; commit task packets before batch start.

### Next steps

1. **Execute Phase 1** waves 0–1 using the plan above (2-lane max for wave 0).
2. **Execute Phase 1b** waves 2–3 so Taskplane limbo is fixable via `spine batch dismiss` / `complete`.
3. Replace Taskplane `/orch` for dogfood as soon as `/spine-retry-task` exists (Phase 3).

### What pi-spine must fix (priority order)

| Priority | Requirement | Phase / Task |
|----------|-------------|--------------|
| P0 | Batch preflight (FR-BATCH-11) | 1 (TP-006 + TP-008) |
| P0 | Batch reconciliation UX (FR-BATCH-12–18) | 1b (TP-009 + TP-010) |
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
| PRD | `docs/PRD.md` / `pi-spine-PRD.md` (v1.2 — reconciliation UX) |
| Incident report | `docs/incidents/20260531-phase0-taskplane-batch.md` |
| Taskplane gaps | `docs/compatibility/taskplane-gap-list.md` |
| Package | `package.json`, `bin/spine.mjs` |

---

## Technical Debt / Future Work

- FR-INIT-05 `spine init --preset taskplane-compat` (Phase 1)
- Batch engine, journal (Phases 2–3) — **recovery tooling is now P1, not nice-to-have**
- Optional: Taskplane `.pi/batch-state.json` adapter folded into TP-009 reconciliation reader
- Do not run Taskplane and pi-spine batches concurrently (PRD §22.1)
- Replace Taskplane `/orch` for dogfood as soon as `/spine-retry-task` exists (Phase 3)
