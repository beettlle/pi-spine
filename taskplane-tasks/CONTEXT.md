# General — Context

**Last Updated:** 2026-05-31
**Status:** Active
**Next Task ID:** TP-006

---

## Current State

Phase 0 complete — batch `20260531T165700` merged to `main` (TP-002–TP-005). TP-002 finished manually after two Taskplane stall kills; see post-mortem.

| Task | Summary | Status |
|------|---------|--------|
| TP-002 | Implement `spine init` + templates | Done (manual completion after stall) |
| TP-003 | Minimal GitHub Actions CI | Done |
| TP-004 | Pi slash command stubs (§15.1) | Done |
| TP-005 | Taskplane testing config + agent overrides | Done |

---

## Revised execution plan (do not repeat 20260531 failure)

### Policy (PRD §23.1)

1. **Preflight before any batch:** `spine doctor`, clean git status, task packets committed.
2. **No `/orch all` on greenfield** until CI exists and largest task has completed once serially.
3. **Serial first** for bootstrap work; parallelize only with proven disjoint scopes.
4. **Recovery literacy:** retry must reset task **and** segment frontier (see incident I-02).

### Next steps

1. **TP-006+:** implement pi-spine recovery requirements (§18.4–18.7) before another parallel dogfood batch.
2. Replace Taskplane `/orch` for dogfood as soon as `/spine-retry-task` exists (Phase 3).

### What pi-spine must fix (priority order)

| Priority | Requirement | Phase |
|----------|-------------|-------|
| P0 | Batch preflight (FR-BATCH-11) | 0 |
| P1 | Atomic task+segment retry (§18.5) | 3 |
| P1 | Progress-aware stall detection (§18.4) | 3 |
| P1 | Abort archive + segment-safe rebuild (§18.6) | 3 |
| P2 | Mixed-outcome merge block (§17.4) | 3 |
| P2 | Honest post-mortem (NFR-OBS-03) | 4 |

Testing commands in `.pi/taskplane-config.json`:
- **unit:** `npm run typecheck`
- **build:** `npm run typecheck`

(No `npm test` script yet — typecheck is the verification gate until tests are added.)

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
- Batch engine, planner, journal (Phases 1–3) — **recovery tooling is now P1, not nice-to-have**
- Do not run Taskplane and pi-spine batches concurrently (PRD §22.1)
- Replace Taskplane `/orch` for dogfood as soon as `/spine-retry-task` exists (Phase 3)
