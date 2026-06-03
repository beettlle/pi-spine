# General — Context

**Last Updated:** 2026-06-03
**Status:** Active
**Next Task ID:** SP-086

---

## Current State

**Phases 0–9 complete on `main`.** Phase 10 (**standalone branding**, SP-051–055) in progress. Phase 11 (**stall recovery & observability**, SP-056–060) complete. Phase 12 (**agent prompts + 77% coverage**, SP-061–069) staged — see agent prompt improvement backlog below.

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

**Operator runbook:** [`docs/adoption/operator-runbook.md`](../docs/adoption/operator-runbook.md) — install, preflight, start/monitor, land loop, gate races, resume/dismiss/complete, dashboard, Taskplane coexistence, troubleshooting.

1. **Preflight** before every batch: `spine preflight` (clean git, no active batch).
2. **One task per batch** is still recommended for implementation work; **multi-task resume** is supported when a paused or failed batch has multiple tasks/lanes (`spine batch resume`). Multi-task **start** works when the plan shows one wave with parallel lanes (`spine plan <scope>` first).
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

**Orchestration note:** Batch `20260602T181027` originally required a fresh batch after the TP-015 single-task resume limit; TP-039–041 closed multi-task resume (validation, engine, integration + docs).

### Phase 8 — Operator UX + worker tools + multi-task resume (complete)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-031 | `spine deps` CLI + `/spine-deps` | **Done** | TP-030 |
| TP-032 | Settings editable-field registry | **Done** | TP-030 |
| TP-033 | `spine settings show` CLI | **Done** | TP-032 |
| TP-034 | `spine settings set` CLI | **Done** | TP-033 |
| TP-035 | `/spine-settings` interactive menu (FR-CFG-03) | **Done** | TP-034 |
| TP-036 | `spine_report_progress` core + CLI + heartbeat | **Done** | TP-030 |
| TP-037 | `spine_review_step` Pi tool | **Done** | TP-036 |
| TP-038 | `spine_request_gate` + worker tool registration | **Done** | TP-037 |
| TP-039 | Multi-task resume validation | **Done** | TP-030 |
| TP-040 | Multi-task resume engine + detached | **Done** | TP-039 |
| TP-041 | Multi-task resume integration + docs | **Done** | TP-040 |
| TP-042 | Lane packing vs parallel execution (planner + engine + dashboard) | **Done** | TP-019, TP-026 |

### Phase 9 — Real-project adoption (no npm publish)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| TP-043 | Local install without npm publish + doctor stale PATH | **Staged** | TP-030 |
| TP-044 | Adoption fixture repo + bootstrap checklist | **Staged** | TP-043 |
| TP-045 | Taskplane / spine mutual exclusion guard | **Staged** | TP-043 |
| TP-046 | FR-CFG-04 env overrides (`SPINE_TASKS_ROOT`, `SPINE_MAX_LANES`) | **Staged** | TP-043 |
| TP-047 | Stub-free dogfood sign-off + flaky test fix | **Staged** | TP-044 |
| TP-048 | Real pi worker + reviewer E2E | **Staged** | TP-047 |
| TP-049 | Operator runbook for external teams | **Done** | TP-048 |
| TP-050 | `createAgentSession` worker backend spike (v1.1) | **Done** | TP-048 |

### Phase 10 — Standalone branding (Taskplane decruft)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-051 | Default `spine init` + docs rebrand (Phase A) | **Done** | — |
| SP-052 | Rename `src/compat/taskplane` module (Phase B) | **Staged** | SP-051 |
| SP-053 | Scaffold `CONTEXT.md` on init | **Staged** | SP-051 |
| SP-054 | `create-spine-tasks` skill | **Staged** | SP-051, SP-053 |
| SP-055 | Migrate pi-spine repo `taskplane-tasks/` → `spine-tasks/` | **Done** | SP-051 |

### Phase 11 — Stall recovery & operator observability

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-056 | FR-STALL-01 worker output capture on terminal failure (P0) | **Done** | — |
| SP-057 | FR-STALL-02 checkpoint warnings; file-scope must not extend grace (P1) | **Done** | SP-056 |
| SP-058 | FR-STALL-03A salvage inspection (read-only) (P1) | **Done** | SP-056 |
| SP-059 | FR-STALL-03B optional `autoCommitOnStall` WIP commit (P2) | **Staged** | SP-058 |
| SP-060 | Epic fixture (SAT-020), runbook, dashboard, gap/PRD closeout (P1) | **Done** | SP-056, SP-057, SP-058 |

**Source brief:** [`docs/features/stall-recovery-improvements-brief.md`](../docs/features/stall-recovery-improvements-brief.md) (SearchATon batch `20260603T002945` / SAT-020).

### Phase 12 — Agent prompts + 77% code coverage

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-061 | 77% line coverage policy — CI, spine-config, worker/reviewer/skill | **Staged** | — |
| SP-062 | Worker execution discipline — resume, checkboxes, scope, context limit | **Staged** | SP-061 |
| SP-063 | Worker review levels 0–3 + L2+ order of operations | **Staged** | SP-062 |
| SP-064 | Commit convention alignment — worker, runner, PRD FR-WORK-03 | **Staged** | SP-063 |
| SP-065 | Reviewer template depth — build gate, REVISE cites, rubric, coverage | **Staged** | SP-061 |
| SP-066 | Supervisor v1 honest stub — CLI/diagnose guidance, no agent session | **Staged** | — |
| SP-067 | Deduplicate runner inline hints vs worker.md | **Staged** | SP-064 |
| SP-068 | PRD Appendix C — review levels table | **Staged** | — |
| SP-069 | Agent template drift test | **Staged** | SP-067 |
| SP-070 | Journal attach test isolation | **Complete** | — |
| SP-071 | CI checkpoint-warning git identity fix | **Staged** | — |

**Policy:** All spine-orchestrated **code-related** deliverables must maintain **≥77% line coverage** (SP-061).

### Phase 13 — Cursor rules audit remediation (SP-072–081)

**Source:** Brutal audit of pi-spine against `.cursor/rules/` (2026-06-03). Cleanliness **7/10** — strong tests/coverage/fail-closed orchestration; gaps in security (evidence shell exec), dead FR-WORK-05 config, god files, silent PROMPT parse degradation, Cursor↔spine standards parity.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-072 | Evidence command hardening (no shell, allowlist) | **Staged** | — |
| SP-073 | Wire FR-WORK-05 standards into worker context | **Staged** | SP-081 |
| SP-074 | Engine strangler: scope + lane modules | **Staged** | SP-075 |
| SP-075 | Fail loud on PROMPT parse errors | **Staged** | — |
| SP-076 | DRY resume shared core | **Staged** | SP-075 |
| SP-077 | Sandbox workerLaunchScript | **Staged** | SP-072 |
| SP-078 | Error-path test hardening | **Staged** | SP-072 |
| SP-079 | Split spine.mjs CLI router | **Staged** | — |
| SP-080 | CI doctor enforce + PR template | **Staged** | — |
| SP-081 | Commit `.cursor/rules` for contributors | **Staged** | — |

**Suggested run order:**

1. **Wave A (parallel):** `SP-075`, `SP-072`, `SP-081`, `SP-080`, `SP-079`
2. **Wave B:** `SP-073` (after SP-081), `SP-077` + `SP-078` (after SP-072)
3. **Wave C:** `SP-074` (after SP-075), then `SP-076` (after SP-075)

### Phase 14 — Orphan running / detached resume (searchATon incident)

**Source:** Consumer bug report — batch `20260603T185308` (searchATon Wave 8). Worker infra failures are expected; **orphan `phase: running`** with dead workerPid/engine is the spine gap.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-082 | Orphan running reconciliation + enginePid persistence | **Staged** | — |
| SP-083 | Detached resume semantics + failure surfacing | **Staged** | SP-082 |
| SP-084 | Heartbeat workerPhase / kind semantics | **Staged** | — |
| SP-085 | Orphan incident fixture + regression test | **Staged** | SP-082 |

**Suggested run order:**

1. **Wave A (parallel):** `SP-082`, `SP-084`
2. **Wave B:** `SP-083`, `SP-085` (after SP-082)

**Suggested spine run order (Phase 13):**

1. **Wave A (parallel):** `SP-061`, `SP-066`, `SP-068`
2. **Wave B (parallel after SP-061):** `SP-062`, `SP-065`
3. **Wave C (serial worker chain):** `SP-063` → `SP-064` → `SP-067` → `SP-069`
4. **Wave D (CI hygiene, parallel when Wave 1 runs):** `SP-071` — fix checkpoint-warning git fixtures (runs 26911437218 / 26911648989)

**Suggested spine run order (Phase 11):**

1. **Wave A:** `node bin/spine.mjs batch start SP-056` (P0 — unblocks diagnose on every stall)
2. **Wave B (parallel after SP-056 lands):** `SP-057` + `SP-058` (disjoint file scope: heartbeat vs salvage module)
3. **Wave C:** `SP-059` (optional; after SP-058)
4. **Wave D:** `SP-060` (integration fixture + docs; after SP-056–058)

**Greenfield init:** `spine init` → `spine-tasks/` with gates, testing, and lane defaults. **Migrants:** `spine migrate-from-taskplane` or `spine init --tasks-root taskplane-tasks` (legacy `--preset taskplane-compat` deprecated).

**Operator docs:** [`docs/adoption/operator-runbook.md`](../docs/adoption/operator-runbook.md)

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
| ~~P2~~ | `/spine-settings` + settings CLI (FR-CFG-03) | 8 | **Done (TP-035)** |
| ~~P2~~ | Worker MCP tools (§14.5) | 8 | **Done (TP-036–038)** |
| ~~P1~~ | Multi-task batch resume | 8 | **Done (TP-039–041)** |
| ~~P1~~ | Lane packing vs parallel execution (GAP-SCHED-01) | 8 | **Done (TP-042)** |
| **P1** | Local install + adoption fixture (pre-publish) | 9 | **Staged (TP-043–044)** |
| **P1** | Stub-free + real-pi dogfood | 9 | **Staged (TP-047–048)** |
| **P2** | Operator runbook + env overrides | 9 | **Staged (TP-046, TP-049)** |
| **P2** | Taskplane coexistence guard | 9 | **Staged (TP-045)** |
| **P3** | createAgentSession backend (v1.1) | 9 | **Staged (TP-050)** |
| **P0** | Stall worker output capture (FR-STALL-01) | 11 | **Done (SP-056)** |
| **P1** | Checkpoint warnings + salvage inspect | 11 | **Done (SP-057, SP-058)** |
| **P2** | Optional WIP commit on stall | 11 | **Staged (SP-059)** |
| **P1** | Stall epic docs + SAT-020 fixture | 11 | **Done (SP-060)** |
| **P1** | 77% code coverage policy | 12 | **Staged (SP-061)** |
| **P1** | Agent prompt improvements (worker/reviewer/supervisor) | 12 | **Staged (SP-062–069)** |

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
| Tasks | `spine-tasks/` |
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
