# General — Context

**Last Updated:** 2026-06-02
**Status:** Active
**Next Task ID:** TP-042

---

## Current State

**Phases 0–6 complete on `main`.** **215/215** tests pass locally (`SPINE_WORKER_STUB=1`). Phase 7 publish prep (TP-030) complete; npm publish deferred to operator.

Phase 0 — batch `20260531T165700` (TP-002–TP-005). Several Phase 1b tasks required **manual supervisor recovery** after Taskplane worker stalls; see post-mortem.

| Task | Summary | Status |
|------|---------|--------|
| TP-002 | Implement `spine init` + templates | Done |
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
| TP-010 | Batch dismiss & complete lifecycle (FR-BATCH-15–18) | Done | TP-009 |

### Phase 1c — CI hygiene (on main)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-011 | CI test fixture hardening | Done | TP-010 |

### Phase 2 — Single-lane worker (on main)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-012 | Single-lane batch engine | Done | TP-011 |
| TP-013 | Checkpoint heartbeat (FR-WORK-09, §18.4) | Done | TP-012 |
| TP-014 | Orchestration journal + batch-state hardening | Done | TP-013 |

### Phase 3 — Recovery + multi-lane (on main)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-015 | Segment model + lane commit + pause/resume | Done | TP-014 |
| TP-016 | Integrate validation + `spine integrate` | Done | TP-015 |
| TP-017 | Atomic retry + skip-task | Done | TP-016 |
| TP-018 | Archive-first abort | Done | TP-017 |
| TP-019 | Multi-lane engine + mixed-outcome merge | Done | TP-018 |

### Phase 4 — Review + gates (on main)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-020 | Review tool + fail-closed worker (FR-REV-06, GAP-REV-01) | Done | TP-019 |
| TP-021 | Integrate gate FSM + evidence bundle (§12) | Done | TP-020 |
| TP-022 | Honest batch post-mortem (NFR-OBS-03, GAP-POST-01) | Done | TP-021 |

---

## Execution policy

1. **Preflight** before every batch: `spine preflight` (clean git, no active batch).
2. **One task per batch** for implementation tasks (recommended); multi-task start works when the plan shows one wave with parallel lanes (`spine plan <scope>` first).
3. **Land loop:** `spine batch start` → monitor `spine status --diagnose` → `spine gate approve` → `spine integrate` → `spine batch complete` → push `main`.
4. **Never** hand-edit `.spine/batch-state.json`.

---

## Next steps — Phase 4 run order

1. Commit Phase 4 packets (if not already on `main`).
2. **`spine batch start TP-020`** — review fail-closed (wave 12).
3. **`spine batch start TP-021`** — integrate gate + evidence (wave 13).
4. **`spine batch start TP-022`** — honest post-mortem (wave 14).
5. **Phase 5 — Dashboard:** `spine batch start TP-023` → TP-025 → TP-026 (see run order below).

### Phase 5 — Operator UX

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-024 | Pending scope + relaxed batch `all` / `spine run pending` | **Done** | TP-022 |
| TP-023 | Dashboard server + SSE snapshot API (§16 backend) | **Done** | TP-024 |
| TP-025 | Dashboard UI panels (§16.1) | **Done** | TP-023 |
| TP-026 | Dashboard parity + `/spine-dashboard` (GAP-UX-03) | **Done** | TP-025 |
| TP-027 | Dashboard CLI startup messaging (URL/port on listen) | **Done** | — |
| TP-028 | `spine doctor` suggests `lanes.maxParallel` | **Done** | — |

### Phase 6 — Compatibility validation (re-opened)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-029 | Incident regression I-01–I-10, ABC integration fixture, gap list, dogfood report | **Done** | TP-028 |

### Phase 7 — Publish & migration (re-opened)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-030 | `migrate-from-taskplane`, `--preset taskplane-compat`, npm publish prep | **Done** | TP-029 |

**Orchestration note:** Batch `20260602T181027` resumed via fresh batch after TP-015 single-task resume limit; land loop completed on `main`.

### Phase 8 — Operator UX + worker tools + multi-task resume (staged)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-031 | `spine deps` CLI + `/spine-deps` | **Done** | TP-030 |
| TP-032 | Settings editable-field registry | **Done** | TP-030 |
| TP-033 | `spine settings show` CLI | **Staged** | TP-032 |
| TP-034 | `spine settings set` CLI | **Staged** | TP-033 |
| TP-035 | `/spine-settings` interactive menu (FR-CFG-03) | **Staged** | TP-034 |
| TP-036 | `spine_report_progress` core + CLI + heartbeat | **Staged** | TP-030 |
| TP-037 | `spine_review_step` Pi tool | **Staged** | TP-036 |
| TP-038 | `spine_request_gate` + worker tool registration | **Staged** | TP-037 |
| TP-039 | Multi-task resume validation | **Done** | TP-030 |
| TP-040 | Multi-task resume engine + detached | **Staged** | TP-039 |
| TP-041 | Multi-task resume integration + docs | **Staged** | TP-040 |

**Suggested spine run order** (preflight before each batch; default detached — monitor with `spine status --diagnose`):

1. **Wave A (parallel OK — disjoint file scopes):**
   ```bash
   spine preflight
   spine plan TP-031 TP-032 TP-036 TP-039    # preview lanes
   spine batch start TP-031 TP-032 TP-036 TP-039
   ```
   Or serial (one task per batch, recommended in execution policy below):
   ```bash
   spine preflight && spine batch start TP-031
   # after .DONE + integrate + complete → repeat for TP-032, TP-036, TP-039
   ```

2. **Wave B:** `spine batch start TP-033` (after TP-032 Done), `TP-037` (after TP-036), `TP-040` (after TP-039)

3. **Wave C:** `spine batch start TP-034`, `TP-038`

4. **Wave D:** `spine batch start TP-035`, `TP-041`

**Land loop per task (or per wave after merge):**
```bash
spine status --diagnose
spine gate approve          # when gates.requireBeforeIntegrate
spine integrate
spine batch complete
git push origin main        # operator
```

**Run all remaining Phase 8 tasks in dependency order:**
```bash
spine preflight
spine plan pending --json   # should include TP-031…TP-041 once prior phases Done
spine batch start pending   # or: spine run pending
```

In pi: `/spine-plan pending`, `/spine TP-031`, `/spine-status`, `/spine-resume`.

---

## Priority backlog

| Priority | Requirement | Phase | Status |
|----------|-------------|-------|--------|
| ~~P1~~ | Phase 3 recovery + multi-lane | 3 | **Done (TP-015–019)** |
| **P1** | Review fail-closed | 4 | **Staged (TP-020)** |
| **P1** | Integrate gate + evidence | 4 | **Staged (TP-021)** |
| P2 | Honest post-mortem | 4 | **Staged (TP-022)** |
| ~~P1~~ | Pending batch scope (`spine batch start pending` / `spine run pending`) | 5 | **Done (TP-024)** |
| ~~P1~~ | Dashboard server + SSE (NFR-OBS-02) | 5 | **Done (TP-023)** |
| ~~P2~~ | Dashboard UI + parity (NFR-OBS-04, GAP-UX-03) | 5 | **Done (TP-025, TP-026)** |
| ~~P3~~ | Dashboard CLI startup operator hints | 5 | **Done (TP-027)** |
| P3 | Doctor `maxParallel` sizing hint | 5 | **Done (TP-028)** |
| **P2** | `/spine-deps` + dependency graph CLI | 8 | **Done (TP-031)** |
| **P2** | `/spine-settings` + settings CLI (FR-CFG-03) | 8 | **Staged (TP-032–035)** |
| **P2** | Worker MCP tools (§14.5) | 8 | **Staged (TP-036–038)** |
| **P1** | Multi-task batch resume | 8 | **Staged (TP-039–041)** |

---

## Verification

From `.pi/taskplane-config.json`:

- **unit:** `npm run typecheck && npm test`
- **build:** `npm run typecheck && npm test`

Run full `npm test` (**150+** tests) for any batch-touching change.

---

## Key Files

| Category | Path |
|----------|------|
| Tasks | `taskplane-tasks/` |
| PRD | `docs/PRD.md` |
| Gap list | `docs/compatibility/taskplane-gap-list.md` |
| Package | `bin/spine.mjs`, `src/batch/` |

---

## Technical Debt / Future Work

- **TP-020** — `taskplane-tasks/TP-020-review-fail-closed/PROMPT.md`
- **TP-021** — `taskplane-tasks/TP-021-integrate-gate/PROMPT.md`
- **TP-022** — `taskplane-tasks/TP-022-honest-postmortem/PROMPT.md`
- **TP-023** — `taskplane-tasks/TP-023-dashboard-server/PROMPT.md`
- **TP-025** — `taskplane-tasks/TP-025-dashboard-ui/PROMPT.md`
- **TP-026** — `taskplane-tasks/TP-026-dashboard-parity/PROMPT.md`
- **TP-027** — `taskplane-tasks/TP-027-dashboard-cli-startup/PROMPT.md`
- **TP-028** — `taskplane-tasks/TP-028-doctor-suggest-max-parallel/PROMPT.md`
- FR-INIT-05 `spine init --preset taskplane-compat` — **Staged (TP-030)**
- `spine migrate-from-taskplane` — **Staged (TP-030)**
