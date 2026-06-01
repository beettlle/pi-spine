# General — Context

**Last Updated:** 2026-06-01
**Status:** Active
**Next Task ID:** TP-020
**Orchestration policy:** **Option B** — prioritize pi-spine **Phase 2/3** (own worker + recovery); Taskplane `/orch` only for bounded, serial dogfood until `/spine-retry-task` exists.

---

## Current State

**Phases 0–1c, TP-012–TP-015 are on `main`.** CI green after TP-011 ([run 26775968226](https://github.com/beettlle/pi-spine/actions/runs/26775968226)). **77/77** tests pass locally (`SPINE_WORKER_STUB=1`). TP-014/TP-015 required manual worktree land once before lane auto-commit shipped; engine now auto-commits lane work and rejects `EmptyMerge` at merge time (`777adcf`).

Phase 0 — batch `20260531T165700` (TP-002–TP-005). TP-002 and several Phase 1b tasks required **manual supervisor recovery** after Taskplane worker stalls; see post-mortem.

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
| TP-010 | Batch dismiss & complete lifecycle (FR-BATCH-15–18) | Done (manual recovery `20260601T100359`) | TP-009 |

### Phase 1c — CI hygiene (on main)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-011 | CI test fixture hardening (`git branch -M main`) | Done (manual recovery `20260601T114445`) | TP-010 |

### Phase 2 — Single-lane worker

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-012 | Single-lane batch engine (`spine batch start`, worktree, pi worker) | **Done** — implement on `main`; dogfood TP-013+ | TP-011 |
| TP-013 | Checkpoint heartbeat (FR-WORK-09, §18.4) | **Done** | TP-012 |
| TP-014 | Orchestration journal + batch-state hardening | **Done** | TP-013 |

### Phase 3 — Segments, resume, multi-lane

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-015 | Segment model + lane commit + pause/resume | **Done** | TP-014 |

### Phase 3 — Integrate, retry, abort, multi-lane (staged)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-016 | Integrate validation + `spine integrate` (**run first**; was “016a”) | **Staged** | TP-015 |
| TP-017 | Atomic retry + skip-task (narrowed ex–TP-016) | **Staged** | TP-016 |
| TP-018 | Archive-first abort | **Staged** | TP-017 |
| TP-019 | Multi-lane engine + mixed-outcome merge | **Staged** | TP-018 |

| Theme | PRD / gaps | Task |
|-------|------------|------|
| Integrate landing | FR-INT-01, complete validation | **TP-016** |
| Atomic retry | §18.5, GAP-RETRY-01 | **TP-017** |
| Archive-first abort | §18.6, GAP-ABORT-01 | **TP-018** |
| Mixed-outcome merge | §17.4, GAP-MERGE-01 | **TP-019** |
| Progress-aware stall | §18.4, GAP-STALL-01 | **Done** (TP-013/015) |
| `/spine-resume` | Phase 3 resume | **Done** (TP-015) |

---

## Execution policy (PRD §23.1 + lessons learned)

1. **Preflight before any batch:** `spine preflight` (clean git, no active batch, wave plan).
2. **No more large Taskplane-only batches** for core spine work — build Phase 2 engine first (Option B).
3. **Until Phase 3:** if using `/orch`, **serial / 1 lane max**; supervisor watches for >15 min tool silence → steer → wrap-up → takeover.
4. **Recovery literacy:** `spine status --diagnose` → `spine batch dismiss` or `complete`; never hand-edit `.pi/batch-state.json`.
5. **Limbo literacy:** all tasks green + batch red `stopped` → dismiss/complete, not pause.

### Historical `/orch` waves (Phase 1 dogfood — complete)

| Wave | Tasks | Outcome |
|------|-------|---------|
| 0 | TP-006 ∥ TP-007 | Succeeded |
| 1 | TP-008 | Succeeded |
| 2 | TP-009 | Succeeded |
| 3 | TP-010 | Succeeded (manual recovery) |
| 4 | TP-011 | Succeeded (manual recovery); CI green |

---

## Next steps (Option B)

1. **Run TP-016** — integrate validation + `spine integrate` (wave 8).
2. **Run TP-017** — atomic retry + skip (wave 9; unblocks `/orch` policy).
3. **Run TP-018** — archive-first abort (wave 10).
4. **Run TP-019** — multi-lane + mixed-outcome merge (wave 11).
5. **Dogfood** — one `spine batch start <id>` per task on `main` that already contains prior tasks’ code.
6. **Phase 4+** — review fail-closed, full integrate gate, dashboard.

**Do not** start Phase 4 gates or multi-lane Taskplane batches until **TP-017** retry lands.

---

## Priority backlog (what pi-spine must fix)

| Priority | Requirement | Phase | Status |
|----------|-------------|-------|--------|
| ~~P0~~ | Batch preflight (FR-BATCH-11) | 1 | **Done** |
| ~~P0~~ | Batch reconciliation UX (FR-BATCH-12–18) | 1b | **Done** |
| ~~P0~~ | CI green on `main` | 1c | **Done** (TP-011) |
| ~~P0~~ | Single-lane worker + batch start | 2 | **Done** (TP-012, TP-013) |
| **P1** | Orchestration journal | 2–3 | **Done (TP-014)** |
| **P1** | Lane commit + segments + resume | 3 | **Done (TP-015)** |
| **P1** | Integrate validation + `spine integrate` | 3 | **Staged (TP-016)** |
| **P1** | Atomic retry + skip (§18.5) | 3 | **Staged (TP-017)** |
| **P1** | Archive-first abort (§18.6) | 3 | **Staged (TP-018)** |
| P2 | Multi-lane + mixed-outcome merge | 3 | **Staged (TP-019)** |
| ~~P1~~ | Progress-aware stall (§18.4) | 3 | **Done** (TP-013/015) |
| P2 | Honest post-mortem (NFR-OBS-03) | 4 | Staged |
| P2 | Dashboard live status (NFR-OBS-04) | 5 | Staged |

---

## Verification

From `.pi/taskplane-config.json`:

- **unit:** `npm run typecheck && npm test`
- **build:** `npm run typecheck && npm test`

Run full `npm test` (77 tests) for any batch- or worker-touching change.

---

## Key Files

| Category | Path |
|----------|------|
| Tasks | `taskplane-tasks/` |
| Config | `.pi/taskplane-config.json` |
| PRD | `docs/PRD.md` / `pi-spine-PRD.md` (v1.2) |
| Incident report | `docs/incidents/20260531-phase0-taskplane-batch.md` |
| Taskplane gaps | `docs/compatibility/taskplane-gap-list.md` |
| Package | `package.json`, `bin/spine.mjs` |

---

## Technical Debt / Future Work

- **TP-016** — `taskplane-tasks/TP-016-integrate-validation/PROMPT.md` (run first)
- **TP-017** — `taskplane-tasks/TP-017-retry-skip/PROMPT.md`
- **TP-018** — `taskplane-tasks/TP-018-abort-archive/PROMPT.md`
- **TP-019** — `taskplane-tasks/TP-019-multi-lane/PROMPT.md`
- FR-INIT-05 `spine init --preset taskplane-compat` (defer until Phase 2 worker stable).
- Taskplane `.pi/batch-state.json` adapter — **done** in TP-009 reconciliation reader (dogfood only).
- Do not run Taskplane and pi-spine batches concurrently (PRD §22.1).
- Repeated worker LLM stalls (TP-010, TP-011) — **root fix is Phase 2/3**, not more `/orch` parallelism.
