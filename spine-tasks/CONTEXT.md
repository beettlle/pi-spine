# General — Context

**Last Updated:** 2026-06-18 (M/L decomposition — SP-282/284/292 → SP-294–299; SP-289/290 resized to S)
**Status:** Active
**Next Task ID:** SP-300

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
| TP-043 | Local install without npm publish + doctor stale PATH | **Done** | TP-030 |
| TP-044 | Adoption fixture repo + bootstrap checklist | **Done** | TP-043 |
| TP-045 | Taskplane / spine mutual exclusion guard | **Done** | TP-043 |
| TP-046 | FR-CFG-04 env overrides (`SPINE_TASKS_ROOT`, `SPINE_MAX_LANES`) | **Done** | TP-043 |
| TP-047 | Stub-free dogfood sign-off + flaky test fix | **Done** | TP-044 |
| TP-048 | Real pi worker + reviewer E2E | **Done** | TP-047 |
| TP-049 | Operator runbook for external teams | **Done** | TP-048 |
| TP-050 | `createAgentSession` worker backend spike (v1.1) | **Done** | TP-048 |

### Phase 10 — Standalone branding (Taskplane decruft)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-051 | Default `spine init` + docs rebrand (Phase A) | **Done** | — |
| SP-052 | Rename `src/compat/taskplane` module (Phase B) | **Done** | SP-051 |
| SP-053 | Scaffold `CONTEXT.md` on init | **Done** | SP-051 |
| SP-054 | `create-spine-tasks` skill | **Done** | SP-051, SP-053 |
| SP-055 | Migrate pi-spine repo `taskplane-tasks/` → `spine-tasks/` | **Done** | SP-051 |

### Phase 11 — Stall recovery & operator observability

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-056 | FR-STALL-01 worker output capture on terminal failure (P0) | **Done** | — |
| SP-057 | FR-STALL-02 checkpoint warnings; file-scope must not extend grace (P1) | **Done** | SP-056 |
| SP-058 | FR-STALL-03A salvage inspection (read-only) (P1) | **Done** | SP-056 |
| SP-059 | FR-STALL-03B optional `autoCommitOnStall` WIP commit (P2) | **Done** | SP-058 |
| SP-060 | Epic fixture (SAT-020), runbook, dashboard, gap/PRD closeout (P1) | **Done** | SP-056, SP-057, SP-058 |

**Source brief:** [`docs/features/stall-recovery-improvements-brief.md`](../docs/features/stall-recovery-improvements-brief.md) (SearchATon batch `20260603T002945` / SAT-020).

### Phase 12 — Agent prompts + 77% code coverage

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-061 | 77% line coverage policy — CI, spine-config, worker/reviewer/skill | **Done** | — |
| SP-062 | Worker execution discipline — resume, checkboxes, scope, context limit | **Done** | SP-061 |
| SP-063 | Worker review levels 0–3 + L2+ order of operations | **Done** | SP-062 |
| SP-064 | Commit convention alignment — worker, runner, PRD FR-WORK-03 | **Done** | SP-063 |
| SP-065 | Reviewer template depth — build gate, REVISE cites, rubric, coverage | **Done** | SP-061 |
| SP-066 | Supervisor v1 honest stub — CLI/diagnose guidance, no agent session | **Done** | — |
| SP-067 | Deduplicate runner inline hints vs worker.md | **Done** | SP-064 |
| SP-068 | PRD Appendix C — review levels table | **Done** | — |
| SP-069 | Agent template drift test | **Done** | SP-067 |
| SP-070 | Journal attach test isolation | **Done** | — |
| SP-071 | CI checkpoint-warning git identity fix | **Done** | — |

**Policy:** All spine-orchestrated **code-related** deliverables must maintain **≥77% line coverage** (SP-061).

### Phase 13 — Cursor rules audit remediation (SP-072–081)

**Source:** Brutal audit of pi-spine against `.cursor/rules/` (2026-06-03). Cleanliness **7/10** — strong tests/coverage/fail-closed orchestration; gaps in security (evidence shell exec), dead FR-WORK-05 config, god files, silent PROMPT parse degradation, Cursor↔spine standards parity.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-072 | Evidence command hardening (no shell, allowlist) | **Done** | — |
| SP-073 | Wire FR-WORK-05 standards into worker context | **Done** | SP-081 |
| SP-074 | Engine strangler: scope + lane modules | **Done** | SP-075 |
| SP-075 | Fail loud on PROMPT parse errors | **Done** | — |
| SP-076 | DRY resume shared core | **Done** | SP-075 |
| SP-077 | Sandbox workerLaunchScript | **Done** | SP-072 |
| SP-078 | Error-path test hardening | **Done** | SP-072 |
| SP-079 | Split spine.mjs CLI router | **Done** | — |
| SP-080 | CI doctor enforce + PR template | **Done** | — |
| SP-081 | Commit `.cursor/rules` for contributors | **Done** | — |

**Suggested run order:**

1. **Wave A (parallel):** `SP-075`, `SP-072`, `SP-081`, `SP-080`, `SP-079`
2. **Wave B:** `SP-073` (after SP-081), `SP-077` + `SP-078` (after SP-072)
3. **Wave C:** `SP-074` (after SP-075), then `SP-076` (after SP-075)

### Phase 16 — Cursor rules auto-discovery (SP-089–094)

**Source:** Design discussion 2026-06-04. Auto-discover `.cursor/rules/` for spine workers with repo profile, committed manifest, micromatch glob match, append `standards[]`, include `taskplane-worker-cursor.mdc`.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-089 | Parser + profile foundation + micromatch dep | **Done** | — |
| SP-090 | `discoverCursorRules` + committed `.spine/rules-manifest.json` | **Done** | SP-089 |
| SP-091 | `selectRulesForWorker` + glob match (append semantics) | **Done** | SP-090 |
| SP-092 | Worker context integration + journal event | **Done** | SP-091, SP-073 |
| SP-093 | `spine rules` CLI + init + doctor | **Done** | SP-091 |
| SP-094 | Design doc + adoption docs + skill | **Done** | SP-092, SP-093 |

**Product decisions (locked):**

1. `config.standards` non-empty **appends** to auto-selected rules (deduped).
2. **`taskplane-worker-cursor.mdc`** included in default worker profile.
3. **`.spine/rules-manifest.json`** committed to git (not gitignored).
4. Glob matching via **`micromatch`**.

**Suggested run order:**

1. **Serial:** `SP-089` → `SP-090` → `SP-091`
2. **Wave (parallel after SP-091):** `SP-092` + `SP-093` (disjoint file scope; SP-092 needs SP-073 landed first)
3. **Docs:** `SP-094` after SP-092 and SP-093

**Relation to SP-073:** SP-073 delivers static FR-WORK-05 wire; SP-092/093 supersede SP-073 Step 3 init defaults with auto-discovery. Run SP-073 before SP-092, or merge SP-073 first on `main`.

### Phase 15 — Task sizing & long-running worker stalls (batch 20260603T225112)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-086 | Task sizing guardrails (skill + doctor) | **Done** | — |
| SP-087 | Real-pi stall defaults + batch guidance | **Done** | SP-086 |
| SP-088 | Per-task stall budget from PROMPT Size | **Done** | SP-087 |

**Suggested run order:** `spine batch start SP-086` → land → `SP-087` → land → `SP-088`

### Phase 14 — Orphan running / detached resume (searchATon incident)

**Source:** Consumer bug report — batch `20260603T185308` (searchATon Wave 8). Worker infra failures are expected; **orphan `phase: running`** with dead workerPid/engine is the spine gap.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-082 | Orphan running reconciliation + enginePid persistence | **Done** | — |
| SP-083 | Detached resume semantics + failure surfacing | **Done** | SP-082 |
| SP-084 | Heartbeat workerPhase / kind semantics | **Done** | — |
| SP-085 | Orphan incident fixture + regression test | **Done** | SP-082 |

**Suggested run order:**

1. **Wave A (parallel):** `SP-082`, `SP-084`
2. **Wave B:** `SP-083`, `SP-085` (after SP-082)

### Phase 17 — Resume parallel-lane orphan (searchATon batch 20260603T224829)

**Source:** Consumer bug report `/Users/cdelgado/Documents/github.com/searchATon/spine-bug-report-batch-20260603T224829.md` (2026-06-04). Extends SP-082: false `running` after `resume --force` when engine dies mid-batch; parallel lane-1 resume; ghost `running` tasks.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-095 | Orphan detect scoped to post-`batch.resumed` journal window | **Done** | — |
| SP-096 | Per-lane sequential multi-task resume | **Done** | — |
| SP-097 | Resume engine crash → terminal journal + phase | **Done** | SP-096 |
| SP-098 | Incident fixture + doc for batch `20260603T224829` | **Done** | SP-095, SP-097 |

**Suggested run order:**

1. **Wave A (parallel):** `SP-095`, `SP-096` (disjoint file scope: orphan-detect vs resume-multi)
2. **Wave B:** `SP-097` (after SP-096 lands — same `resume-multi.mjs`)
3. **Wave C:** `SP-098` (after SP-095 + SP-097)

### Phase 18 — Global CLI symlink silent no-op (customer bug)

**Source:** Customer bug report (2026-06-04). `npm install -g pi-spine` exposes `spine` as a symlink; `isMainModule` compares unresolved paths → CLI never runs, exit 0 with no output.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-099 | Symlink-aware `isCliEntrypoint` + all bin entrypoints + regression test | **Done** | — |
| SP-100 | Accept `./scripts/` worker launch script paths (secondary UX) | **Done** | — |

**Suggested run order:**

1. **Wave A (parallel):** `SP-099` + `SP-100` (disjoint scope: `bin/` vs `src/config/`)
2. **Priority:** Land **SP-099** first for operator impact (P0 customer-facing)

**Acceptance (SP-099):** `spine plan pending` via global symlink prints plan or stderr error; never silent exit 0. Direct `node …/bin/spine.mjs` unchanged. CI symlink spawn test.

### Phase 20 — Brutal audit wave (2026-06-05)

**Source:** Three parallel brutal audits (SP-106–108) covering batch reliability, core architecture/CLI, and adoption/test quality. Aggregate cleanliness **6–7/10**.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-106 | Brutal audit: batch engine & reliability | **Done** | — |
| SP-107 | Brutal audit: core architecture & CLI | **Done** | — |
| SP-108 | Brutal audit: adoption, docs & test quality | **Done** | — |

**Reports:** `spine-tasks/SP-106-audit-batch-reliability/AUDIT-REPORT.md`, `SP-107-…/AUDIT-REPORT.md`, `SP-108-…/AUDIT-REPORT.md`

### Phase 21 — Audit remediation (SP-109–118)

**Source:** Synthesized findings from Phase 20 audits (33 findings → 10 remediation tasks).

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-109 | Fail-loud PROMPT validation in planner/plan | **Done** | — |
| SP-110 | Fix glob scope regex escape | **Done** | — |
| SP-111 | Orphan detect: PID-less ghost running | **Done** | — |
| SP-112 | Spine-config testing defaults + doctor warn | **Done** | — |
| SP-113 | Strangler split resume-multi.mjs | **Done** | — |
| SP-114 | Coverage TEST_GLOBS parity with npm test | **Done** | — |
| SP-115 | Orphan diagnosis taxonomy (worker_orphaned) | **Done** | SP-111 |
| SP-116 | batch-state-io extract + git error surfacing | **Done** | — |
| SP-117 | Detached enginePid persistence symmetry | **Done** | SP-111 |
| SP-118 | Adoption docs + test script hygiene | **Done** | — |
| SP-119 | Require Testing step in docs-only task packets | **Done** | — |

**Batch:** `20260605T191325` (stress test, 10 tasks) — landed on `main`, 596 tests.

### Phase 22 — Stress-test follow-ups (SP-120–122)

**Source:** Operator recovery from batch `20260605T191325` and `20260605T213158`.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-120 | Batch retry clears stale failed task state | **Done** | — |
| SP-121 | Auto-resolve rules-manifest merge conflicts | **Done** | — |
| SP-122 | Preflight plan validates pending scope only | **Done** | — |

### Phase 20 — v2.0 CDO (coarse) — Cancelled

**Archived:** 2026-06-11 → `spine-tasks/_archive/phase20-coarse/` (SP-123–SP-140).  
**Reason:** M/L packets replaced by S-sized Phase 20b (SP-141–SP-170).

### Phase 20b — v2.0 CDO S-sized splits

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../docs/PRD-v2.0-implementation-handoff.md#111-task-decomposition--s-sized-sp-141sp-170--active)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-141 | Config defaults v2 (review, handoff, metrics) | **Done** | SP-122 |
| SP-142 | Contract config validation | **Done** | SP-141 |
| SP-143 | Contract parser | **Done** | SP-142 |
| SP-144 | Contract validate wire-up | **Done** | SP-143 |
| SP-145 | `spine tasks validate` CLI core | **Done** | SP-144 |
| SP-146 | `spine tasks validate` JSON output | **Done** | SP-145 |
| SP-147 | Handoff data assembly | **Done** | SP-142 |
| SP-148 | Handoff render and CLI | **Done** | SP-147 |
| SP-149 | Final verdict parsing | **Done** | SP-142 |
| SP-150 | Final review spawn path | **Done** | SP-149 |
| SP-151 | Engine final review phase | **Done** | SP-150 |
| SP-152 | Engine REVISE cap | **Done** | SP-151 |
| SP-153 | Engine REPLAN and merge block | **Done** | SP-152 |
| SP-154 | Contract verify core | **Done** | SP-144, SP-150 |
| SP-155 | Contract verify engine hook | **Done** | SP-154, SP-151 |
| SP-156 | `needs_replan` taxonomy | **Done** | SP-153 |
| SP-157 | `needs_replan` reconcile | **Done** | SP-156 |
| SP-158 | Task metrics writer | **Done** | SP-153 |
| SP-159 | Batch metrics writer | **Done** | SP-158 |
| SP-160 | Skill explore Step 0 | **Done** | SP-144 |
| SP-161 | Skill Contract template | **Done** | SP-144 |
| SP-162 | Runbook validate and handoff | **Done** | SP-146, SP-148 |
| SP-163 | Runbook replan and metrics | **Done** | SP-157, SP-169 |
| SP-164 | Phase 20 fixtures | **Done** | SP-146, SP-153 |
| SP-165 | Adoption smoke Phase 20 | **Done** | SP-166, SP-157, SP-169 |
| SP-166 | Preflight tasks-validate slash | **Done** | SP-146 |
| SP-167 | Handoff slash and journal | **Done** | SP-148 |
| SP-168 | Agent templates final verdict | **Done** | SP-150, SP-155 |
| SP-169 | `spine metrics show` CLI | **Done** | SP-159 |
| SP-170 | CONTEXT Phase 20b tracking | **Done** | SP-160–169 (leaves) |

**Phase 20b exit criteria (handoff §12.5):**

- [x] `spine tasks validate pending` passes on dogfood pending scope
- [x] Stub batch demonstrates PASS, REVISE cap, REPLAN → `needs_replan`
- [x] Contract verifier runs on `SP-*` tasks with `## Contract`
- [x] `TP-*` legacy tasks validate without Contract
- [x] `spine handoff` + `spine metrics show` operational
- [x] adoption-smoke includes validate step

**Suggested batches (≤3 tasks; real pi workers):**

1. `SP-141` → `SP-142` → `SP-143`+`SP-160` → `SP-144`+`SP-161` → `SP-145` → `SP-146`
2. `SP-147`+`SP-149` → `SP-148`+`SP-150` → `SP-166`
3. `SP-151` → `SP-152` → `SP-153` (serial — engine-lanes)
4. `SP-154` → `SP-155`+`SP-168` → `SP-156` → `SP-157`+`SP-167`
5. `SP-158` → `SP-159`+`SP-169` → `SP-162` → `SP-163` → `SP-164` → `SP-165` → `SP-170`

**Regression gate (each batch):** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

**Batch:** `20260605T213158` (SP-119–121) — landed on `main`, 606 tests. Lane-2 merge still required manual rules-manifest resolution (SP-121 landed same batch).

**Suggested run order:**

1. **Wave A (parallel):** `SP-109`, `SP-110`, `SP-111`, `SP-112`
2. **Wave B (parallel):** `SP-113`, `SP-114`, `SP-116`, `SP-118`
3. **Wave C (parallel after SP-111):** `SP-115`, `SP-117`

### Phase 19 — Lane worktree devcontainer fix (searchATon batch 20260605T160800)

**Source:** Consumer bug report — searchATon batch `20260605T160800` (2026-06-05). Lane worktrees get container-absolute `.git` gitdir pointers; devcontainer lane-only mounts break host git; worker launch fails without `PI_SPINE_ROOT`; lane commit `git add -A` masks out-of-scope dirty state.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-101 | Normalize lane worktree gitdir to relative paths + resume repair | **Done** | — |
| SP-102 | `worktreeSetupHook` runner (FR-WT-05) — sandbox, 120s, JSON | **Done** | SP-101 |
| SP-103 | `PI_SPINE_ROOT` in worker spawn env | **Done** | SP-101 |
| SP-104 | Lane commit ordering + scoped dirty filter | **Done** | SP-101, SP-102 |
| SP-105 | Launch failure diagnosis + incident doc | **Done** | SP-104 |

**Suggested run order:**

1. **Wave A:** `SP-101` (gitdir normalization — unblocks host + devcontainer git)
2. **Wave B (parallel after SP-101):** `SP-102` + `SP-103` (disjoint scope: worktree hook vs worker env)
3. **Wave C:** `SP-104` (after SP-101 + SP-102 — hardened lane commit)
4. **Wave D:** `SP-105` (after SP-104 — diagnosis surfaces launch/worktree failures)

**Acceptance (SP-101):** Fresh lane worktrees pass `git status` on host; no absolute `/workspace/...` in `.git` gitfile.

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

### Phase 22 — Reliability epic (SP-REL / SP-171–191)

**Source:** [docs/PRD-v2.1-reliability-handoff.md](../docs/PRD-v2.1-reliability-handoff.md)  
**Explore:** [`spine-tasks/_explore/reliability-epic/findings.md`](_explore/reliability-epic/findings.md)

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-171 | Reliability handoff doc | **Done** | SP-170 |
| SP-172 | Explore findings | **Done** | SP-171 |
| SP-173 | Journal timeline reader | **Done** | SP-172 |
| SP-174 | Journal rebuild core | **Done** | SP-173 |
| SP-175 | Reconcile state drift | **Done** | SP-174 |
| SP-176 | Atomic task transition | **Done** | SP-175 |
| SP-177 | Wire atomic transitions | **Done** | SP-176 |
| SP-178 | Real-pi CI workflow | **Done** | SP-172 |
| SP-179 | Multi-task real-pi fixture | **Done** | SP-178 |
| SP-180 | Consumer pilot template | **Done** | SP-179 |
| SP-181 | agentSession doctor | **Done** | SP-177 |
| SP-182 | agentSession abort fail-loud | **Done** | SP-181 |
| SP-183 | agentSession dogfood report | **Done** | SP-182 |
| SP-184 | Resume wait-terminal default | **Done** | SP-175 |
| SP-185 | Doctor worktree health | **Done** | SP-172 |
| SP-186 | Attached-first runbook | **Done** | SP-185 |
| SP-187 | npm publish prep | **Done** | SP-180 |
| SP-188 | Auto wave integrate | **Done** | SP-177 |
| SP-189 | Contract required flip | **Done** | SP-170 |
| SP-190 | Handoff autoWriteOn | **Done** | SP-189 |
| SP-191 | CONTEXT Phase 22 tracking | **Done** | leaves |
| SP-192 | Engine honors worker final review | **Done** | SP-151, SP-179 |

### Phase 22b — Worker wedge epic (SP-193–198)

**Incident:** Batch `20260611T222221` — SP-190 wrote `.DONE` but pi child hung on nested `spine review step`; engine wedged 17m (`doneFound: true`, `task.failed` on manual kill).

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-193 | Post-.DONE worker grace watchdog | **Done** | SP-192 |
| SP-194 | Block nested pi reviewer in worker | **Done** | SP-193 |
| SP-195 | Engine code review phase (RL≥2) | **Done** | SP-194, SP-151 |
| SP-196 | Worker prompt review delegation | **Done** | SP-195 |
| SP-197 | SP-190 wedge incident fixture | **Done** | SP-193, SP-195 |
| SP-198 | Worker wedge epic capstone | **Done** | SP-193–197 |
| SP-199 | Contract placeholder resolution | **Done** | SP-193 |
| SP-200 | Resume opens integrate gate | **Done** | SP-193 |
| SP-201 | Integrate rules-manifest auto-merge | **Done** | SP-193 |
| SP-202 | Pi timeout / stall budget alignment | **Done** | SP-088 |
| SP-203 | Engine review orphan recovery | **Done** | SP-192, SP-200 |
| SP-204 | Post-merge limbo auto-gate | **Done** | SP-200 |

#### Phase 22c — Stress test hotfixes (SP-227–231)

**Incident:** Autonomous SP-205–225 stress test (2026-06-12) — Waves 0–5 landed; Wave 6 (SP-214) blocked on real-pi crash + stub false `.DONE`; batch `20260612T204048` force-dismissed.

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-227 | Preflight git-clean rules-manifest drift | **Done** | SP-201, SP-090 |
| SP-228 | Attached batch land-loop completion | **Done** | SP-204, SP-200 |
| SP-229 | Worker orphan final-review recovery | **Done** | SP-203, SP-193, SP-115 |
| SP-230 | Exit verification stub guard | **Done** | SP-199, SP-115 |
| SP-231 | Phase 23 exit audit helper | **Done** | SP-213, SP-211, SP-212 |
| SP-232 | Pin agent models (worker `--model` pin) | **Done** | SP-212, SP-088 |
| SP-238 | Worker model pin template + runbook | **Done** | SP-232 |

**Suggested batches (hotfixes before SP-214 retry):** SP-227 → SP-228 → SP-229 → (SP-230 + SP-231 parallel) → re-run SP-214 (real pi).

**Post stress-test (2026-06-12):** SP-232/238 — real-pi batches inherited `pi-lmstudio` via `inherit`; worker runner must pass `--model` from spine-config; template/runbook in SP-238.

**Size decomposition (2026-06-12):** Phase 24–26 M tasks split into S/M slices (SP-233–242). SP-218 superseded by SP-235/236. Run model-pin batch before consumer real-pi work.

**Suggested batches:** Land-loop follow-ups closed (SP-203, SP-204). Worker wedge epic closed (SP-193–198, SP-202).

**Phase 22 exit criteria:**

- [x] Journal rebuild parity on incident fixtures
- [x] `state_drift` in `spine status --diagnose`
- [x] Real-pi CI workflow documented and runnable (SP-178; SP-192 engine fix landed — re-run `./scripts/real-pi-adoption-e2e.sh --batch` for sign-off)
- [x] Tier 3 consumer pilot template filled (`docs/adoption/consumer-pilot-report-template.md`, SP-180)
- [x] Attached-first guidance in operator runbook
- [x] CONTEXT Phase 22 complete; worker wedge epic closed (SP-193–198); Next Task ID → SP-205

**Suggested batches:** See handoff §5 — serial Waves B–C before real-pi sign-off (Wave D).

### Phase 23–26 — Ship readiness epic (SP-SHIP / SP-205–226)

**Status:** **In progress** — Phases 23–25 complete on `main`; Phase 26 publish pending (human-gated). Spec at [`docs/PRD-v2.2-ship-readiness-handoff.md`](../docs/PRD-v2.2-ship-readiness-handoff.md).

**Incident (2026-06-12):** Batch `20260612T225744` (SP-215–226) landed stub-only `.DONE` files (`Task: stub`) with no product code. Integrate gate approved; operator reset invalidated all 21 false completions (removed `.DONE` + stub `.reviews/`). Re-run with **real pi** (`unset SPINE_WORKER_STUB`) starting SP-232.

| Phase | Theme | npm? |
|-------|-------|------|
| 23 (P0) | CI trust, engine-lanes split, real-pi CI hardening, doc sync | No |
| 24 (P1) | Consumer pilot, extension tests, dashboard parity, journal export | No |
| 25 (P2) | Journal structural rebuild, supervisor/merger/worker-gate stories | No |
| 26 | npm publish + pi.dev listing (human-gated) | **Final step only** |

**Explore (planned):** `engine-lanes-split` — SP-207 writes `spine-tasks/_explore/engine-lanes-split/findings.md` before SP-208–211 split.

#### Phase 23 — P0 Trust & maintainability

| Task | Summary | Status | Deps |
|------|---------|--------|------|
| SP-205 | Ship readiness handoff doc (PRD cross-links) | **Done** | SP-204 |
| SP-206 | CI trust + SAT-020 guard | **Done** | SP-205 |
| SP-207 | Engine-lanes split explore findings | **Done** | SP-205 |
| SP-208 | Extract wave/tick scheduling module | **Done** | SP-207 |
| SP-209 | Extract lane queue / provisioning | **Done** | SP-208 |
| SP-210 | Extract review-phase wiring | **Done** | SP-209 |
| SP-211 | Extract merge-phase wiring; god-file removal | **Done** | SP-210 |
| SP-212 | Real-pi CI blocking hardening | **Done** | SP-206 |
| SP-213 | Operator doc sync (CONTEXT + readiness) | **Done** | SP-205 |
| SP-214 | Phase 23 exit verification | **Done** | SP-211, SP-212, SP-213 |

**Phase 23 exit criteria (PRD §8):**

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — zero failures (772 tests, 2026-06-12)
- [x] No `src/batch/*.mjs` file >500 lines without grandfather list (`spine verify phase23-exit`; `engine-lanes.mjs` split complete)
- [x] Real-pi workflow present; skip-when-absent documented (`.github/workflows/real-pi.yml`, operator runbook)
- [x] CONTEXT.md Phase 23 table aligned with landed work (SP-205–214 Done)
- [x] `real-project-readiness.md` test counts updated

**Suggested batches (Phase 23):** Complete — Phase 24 unblocked.

#### Phase 24 — P1 Prove & parity

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-232 | Worker `--model` pin | S | **Done** | SP-212, SP-088 |
| SP-238 | Model pin template + runbook | S | **Done** | SP-232 |
| SP-215 | Consumer pilot stub + skeleton | S | **Done** | SP-214 |
| SP-233 | Consumer pilot real-pi + recovery | M | **Done** | SP-215 |
| SP-216 | Extension slash-command tests ≥70% | M | **Done** | SP-214 |
| SP-217 | Dashboard gate + diagnosis | S | **Done** | SP-214 |
| SP-234 | Dashboard journal tail panel | S | **Done** | SP-217 |
| SP-235 | Journal export jsonl CLI | S | **Done** | SP-214 |
| SP-236 | Journal export markdown timeline | S | **Done** | SP-235 |
| SP-219 | agentSession decision (report) | S | **Done** | SP-214 |
| SP-237 | agentSession doctor alignment | S | **Done** | SP-219 |
| SP-218 | Journal export CLI (superseded) | — | **Done** | → SP-235/236 |
| SP-220 | Phase 24 exit verification | S | **Done** | SP-233, SP-216, SP-234, SP-236, SP-237 |

**Phase 24 exit criteria (PRD §8):**

- [x] Filled consumer pilot report committed under `docs/adoption/` (`consumer-pilot-report-2026-06-12.md`, SP-233)
- [x] `extensions/spine/slash-commands.ts` line coverage ≥70% (92%+; gate in `scripts/coverage-policy.mjs`, SP-216)
- [x] Dashboard default view shows gate + diagnosis + journal affordance (`tests/dashboard/ui-contract.test.mjs`, SP-217/234)
- [x] `spine journal export` documented and tested (`journal-export-*.test.mjs`, operator runbook, SP-235/236)
- [x] agentSession decision recorded in dogfood report + runbook (subprocess default; SP-219/237)
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — zero failures (828 tests, 2026-06-13)
- [x] `npm run coverage:check` — 85.77% line (threshold 77%)

**Suggested batches (Phase 24):** Complete — Phase 25 unblocked.

#### Phase 25 — P2 Differentiation

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-221 | Journal structural rebuild (core) | M | **Done** | SP-220 |
| SP-240 | Journal rebuild incident fixtures | S | **Done** | SP-221 |
| SP-222 | Supervisor defer documentation | S | **Done** | SP-220 |
| SP-223 | Merger conflict UX spike | S | **Done** | SP-220 |
| SP-241 | Worker gate inventory | S | **Done** | SP-220 |
| SP-224 | Worker manual gate execution | S | **Done** | SP-241 |
| SP-225 | Phase 25 exit verification | S | **Done** | SP-240, SP-222, SP-223, SP-224 |

**Phase 25 exit criteria (PRD §8):**

- [x] FR-SHIP-10 implemented — `journal-rebuild.mjs` structural derivation (SP-221); incident fixture regression + runbook limits vs Babysitter replay (SP-240); not deferred to v2.3
- [x] Supervisor defer documented — runbook §Supervisor deferred (FR-SHIP-11), README honest limits (SP-222)
- [x] Merger/conflict path documented — `docs/design/integrate-conflict-recovery.md`, runbook §4.1; merger-agent explicit non-goal (SP-223)
- [x] Worker gate story resolved — permanent `not_supported` for all gate kinds; runbook §5.1 + README workaround via host `spine gate approve` (SP-241/224)
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — zero failures (838 tests, 2026-06-14; unset `SPINE_WORKER_PI_TIMEOUT_MS` in shell)
- [x] `npm run coverage:check` — 85.92% line (threshold 77%)

**Suggested batches (Phase 25):** Complete — Phase 26 unblocked (human-gated publish).

#### Phase 26 — Publish (human-gated)

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-242 | npm pre-release checklist + dry-run | S | **Done** | SP-225 |
| SP-226 | npm publish execution (human-gated) | S | **Done** | SP-242 |
| SP-255 | pi.dev listing + post-publish doc sync | M | **Done** | SP-226 |

#### Phase 27 — Reviewer Cursor rules (FR-REV-08)

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-246 | Reviewer rules profile section | S | **Done** | — |
| SP-249 | Review scope path resolver | S | **Done** | — |
| SP-247 | Shared selection core refactor | M | **Done** | SP-246 |
| SP-248 | `selectRulesForReviewer` | S | **Done** | SP-247 |
| SP-250 | Reviewer context builder + journal | M | **Done** | SP-248, SP-249 |
| SP-251 | Review spawn rules injection | S | **Done** | SP-250 |
| SP-252 | CLI reviewer rules preview | S | **Done** | SP-248, SP-249 |
| SP-253 | Reviewer rules docs + FR-REV-08 | S | **Done** | SP-251, SP-252 |

**Suggested batches (Phase 27):**

1. **Wave 1 (parallel):** `SP-246` + `SP-249`
2. **Wave 2:** `SP-247`
3. **Wave 3:** `SP-248`
4. **Wave 4:** `SP-250`
5. **Wave 5 (parallel):** `SP-251` + `SP-252`
6. **Wave 6:** `SP-253`

**Regression gate (every batch):** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run coverage:check`

#### Phase 28 — Post-publish hardening (Best-of-N audit 2026-06-17)

**Source:** Headless Best-of-N audit (`scripts/best-of-n.mjs`). Original M packets **SP-257–262 superseded** by S children **SP-263–275** (2026-06-17).

**Agent models (all Phase 28 tasks):** worker `cursor/auto`, reviewer `google/gemini-3.1-pro-preview` (set via `spine settings` before batch).

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-256 | Fix `commandExists` pi availability check | S | **Done** | — |
| SP-263 | SAT-020 coverage flake diagnosis | S | **Done** | — |
| SP-264 | SAT-020 coverage stabilization fix | S | **Done** | SP-263 |
| SP-265 | Extract review-shared pure helpers | S | **Done** | — |
| SP-266 | Wire review dedup imports | S | **Done** | SP-265 |
| SP-267 | Extract review-spawn module | S | **Staged** | SP-266 |
| SP-268 | Review-spawn tests and guard regression | S | **Staged** | SP-267 |
| SP-269 | Move config loaders to src/config | S | **Done** | — |
| SP-270 | Rewire batch imports off bin | S | **Done** | SP-269 |
| SP-271 | Rewire cli/migrate + layer inversion test | S | **Done** | SP-269 |
| SP-272 | ESLint flat config and npm script | S | **Done** | — |
| SP-273 | Wire lint into CI and runbook | S | **Done** | SP-272 |
| SP-274 | Add tsconfig.batch and typecheck script | S | **Staged** | SP-271 |
| SP-275 | JSDoc checkJs for batch hot paths | S | **Staged** | SP-274 |
| SP-276 | Best-of-N README documentation | S | **Done** | — |
| SP-277 | CI-first publish doc sync | S | **Done** | — |

**Superseded (`.SUPERSEDED`):** SP-257→263–264, SP-258→265–266, SP-259→267–268, SP-260→269–271, SP-261→272–273, SP-262→274–275

**Suggested batches (remaining — 6 pending):**

1. **Wave 0 (parallel):** `SP-267`, `SP-274`, `SP-281`
2. **Wave 1 (parallel):** `SP-268`, `SP-275`
3. **Wave 2:** `SP-282` (closes #5)

Completed Phase 28 slices (`.DONE`): SP-256, SP-263–266, SP-269–273, SP-276–277.

#### Phase 29 — GitHub issue fixes (2026-06-17)

**Source:** Issues [#1](https://github.com/beettlle/pi-spine/issues/1), [#2](https://github.com/beettlle/pi-spine/issues/2), [#3](https://github.com/beettlle/pi-spine/issues/3). Batch `20260618T000943` landed on `main`.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-278 | Worker review-step delegate (skip nested spawn) | M | **Done** | — | #1 |
| SP-279 | Engine final-review stall recovery | M | **Done** | SP-278 | #2 |
| SP-280 | Post-merge integrate gate auto-open | S | **Done** | — | #3 |

#### Phase 30 — GitHub issue follow-ups (2026-06-18)

**Source:** Issues [#4](https://github.com/beettlle/pi-spine/issues/4), [#5](https://github.com/beettlle/pi-spine/issues/5). Batch `20260618T000943` and `20260618T191236` landed on `main`.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-281 | Attached batch integrate gate limbo (SP-280 follow-up) | M | **Done** | — | #4 |
| ~~SP-282~~ | Reviewer early artifact honor | M | **Superseded** | — | #5 → SP-294–295 |

#### Phase 31 — GitHub issue follow-ups (2026-06-18, batch 20260618T191236)

**Source:** Open issues [#6](https://github.com/beettlle/pi-spine/issues/6), [#7](https://github.com/beettlle/pi-spine/issues/7), [#8](https://github.com/beettlle/pi-spine/issues/8) filed during batch `20260618T191236` operations.

Each task **closes its issue** in Documentation & Delivery via `gh issue close`.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-283 | Batch start rejects `.SUPERSEDED` task IDs | S | **Staged** | — | #6 |
| ~~SP-284~~ | Engine orphan resume without manual pause | M | **Superseded** | — | #7 → SP-296–297 |
| SP-285 | Engine reviewer nested spawn env fix | S | **Staged** | SP-268 | #8 |
| SP-294 | Early artifact honor core | S | **Staged** | SP-285 | — |
| SP-295 | Early artifact honor delivery | S | **Staged** | SP-294 | #5 |
| SP-296 | Engine orphan resume core | S | **Staged** | — | — |
| SP-297 | Engine orphan resume delivery | S | **Staged** | SP-296 | #7 |

**Superseded (`.SUPERSEDED`):** SP-282→294–295, SP-284→296–297

**Suggested batches (reliability):**

1. **Wave 0 (parallel):** `SP-268`, `SP-275`, `SP-283`, `SP-296`
2. **Wave 1:** `SP-285`, `SP-297`
3. **Wave 2:** `SP-294`, `SP-295`

FR-SHIP-04 (doc sync, SP-213) closes stale entries in this file's priority backlog.

#### Phase 32 — Spec-kit upstream adoption (compose, don't merge)

**Source:** Spec-kit pattern study — adopt pre-execution authoring gates without integrating `specify` CLI or `.specify/` state. Compose spec-kit (or skill equivalents) upstream; execute with pi-spine batches.

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-286 | Path 4 spec-kit upstream docs | S | **Staged** | — |
| SP-287 | Spec persistence models doc | S | **Staged** | — |
| SP-288 | Constitution init template | S | **Staged** | — |
| SP-289 | Skill clarify step (Step A.5) | S | **Staged** | — |
| SP-290 | Skill requirements checklist (Step A.6) | S | **Staged** | SP-289 |
| SP-291 | Skill lean vs full authoring modes | S | **Staged** | SP-289, SP-290 |
| ~~SP-292~~ | `spine tasks analyze` CLI | M | **Superseded** | — | → SP-298–299 |
| SP-293 | Operator authoring approval checklist | S | **Staged** | SP-286, SP-287, SP-291, SP-299 |
| SP-298 | tasks analyze module | S | **Staged** | — |
| SP-299 | tasks analyze CLI delivery | S | **Staged** | SP-298 |

**Superseded (`.SUPERSEDED`):** SP-292→298–299

**Suggested batches (spec-kit):**

1. **Wave 0 (parallel):** `SP-286`, `SP-287`, `SP-288`, `SP-298`
2. **Wave 1:** `SP-289`, `SP-290`, `SP-299`
3. **Wave 2:** `SP-291`, `SP-293`

**Non-goals:** No `specify` CLI dependency, no auto-import of spec-kit `tasks.md`, no `.specify/` state in spine engine.

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

Run full `npm test` for any batch-touching change (`npm run typecheck && SPINE_WORKER_STUB=1 npm test`).

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
