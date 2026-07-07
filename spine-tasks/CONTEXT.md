# General — Context

**Last Updated:** 2026-07-07 (Phase 59 v1.8.1 reconciliation — SP-511–520 staged)
**Status:** Active
**Next Task ID:** SP-521

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

**Contract `testCommand` false positives in worker sessions:** Real-pi workers set `SPINE_IS_WORKER=1`. When Contract `testCommand` runs the full test suite, pre-existing tests that call `startBatch` fail with `nested_batch_spawn_blocked` — the batch may show `contract_failed` even though the worker finished (`.DONE`, review APPROVE, scoped tests pass). This is environmental, not a bad task diff. Diagnosis and recovery: operator runbook [§9 — Contract `testCommand` false positives in worker environment](../docs/adoption/operator-runbook.md#contract-testcommand-false-positives-in-worker-environment-issue-132). Prefer scoped `testCommand` matching the PROMPT Testing step; SP-491 will sanitize contract subprocess env ([#155](https://github.com/beettlle/pi-spine/issues/155)).

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
3. **Wave 2:** ~~`SP-282`~~ → SP-294/295 (superseded, retired 2026-07-04)

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

#### Phase 33 — README trim (pre-release) — **complete**

**Source:** README slim-down plan (Taskplane-style onboarding; ≤180 lines).  
**Explore:** [`spine-tasks/_explore/readme-trim/findings.md`](_explore/readme-trim/findings.md) (2026-06-18, complete)

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-300 | README trim inventory (explore findings) | S | **Done** | — |
| SP-301 | Positioning doc extract (`why-pi-spine.md`) | S | **Done** | SP-300 |
| SP-302 | README slim rewrite | M | **Done** | SP-301 |
| SP-303 | Doc absorption gap-fill | M | **Done** | SP-302 |
| SP-304 | Doc index and adoption sync | S | **Done** | SP-302 |
| SP-305 | README release verification | S | **Done** | SP-303, SP-304 |

**Exit criteria (SP-305):**

- [x] `wc -l README.md` ≤ 180 (147 lines)
- [x] No `FR-` / `GAP-` / `NFR-` / `§` in README
- [x] New-user quickstart in README; operator depth in `docs/`
- [x] Version line aligned with `package.json` (v1.0.2)

**Suggested batches:**

1. **Wave 0:** `SP-300`
2. **Wave 1:** `SP-301`
3. **Wave 2:** `SP-302`
4. **Wave 3 (parallel):** `SP-303` + `SP-304`
5. **Wave 4:** `SP-305`

**Regression gate (every batch):** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

#### Phase 34 — Dashboard UX

**Source:** Operator feedback — duplicate journal tail (SP-306); lane phase visibility (SP-307).

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-306 | Remove duplicate dashboard Journal tail panel | S | **Staged** | — |
| SP-307 | Lane activity phase column (journal inference) | M | **Staged** | — |

**Acceptance (SP-306):** No `#default-journal-section`; journal only in `#active-panels`.

**Acceptance (SP-307):** Lanes table **Phase** column; labels from journal + active task (no batch-state schema change).

**Suggested batches:** `SP-306` and `SP-307` are disjoint scope — may run in parallel after preflight.

#### Phase 35 — Review spawn reliability (follow-up)

**Source:** GitHub #12 — SP-306 plan `nested_spawn_blocked` orphaned worker in batch `20260619T020951`.

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-308 | Plan review nested_spawn recurrence fix | S | **Staged** | SP-285 |
| SP-309 | Batch resume orphan recovery | S | **Staged** | SP-296 |

**Suggested batch:** `SP-308` `SP-309` after current wave-0 batch lands (disjoint file scope — may run in parallel).

#### Phase 36 — Wave merge reliability

**Source:** GitHub #14 — wave 3 merge conflict on `docs/adoption/operator-runbook.md` in batch `20260619T020951`.

| ID | Title | Size | Status | Depends |
|----|-------|------|--------|---------|
| SP-310 | Wave merge adoption docs conflict resolution | M | **Staged** | SP-305 |

**Suggested batch:** `SP-310` after `SP-308` `SP-309` (depends on SP-305 — landed).

#### Phase 37 — GitHub issue fixes (#15, #16)

**Source:** Open issues [#15](https://github.com/beettlle/pi-spine/issues/15) (merge `git add` on gitignored paths), [#16](https://github.com/beettlle/pi-spine/issues/16) (run-metrics.jsonl breaks preflight git-clean).

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-311 | Merge gitignored path filter | M | **Done** | — | #15 |
| SP-312 | run-metrics.jsonl init gitignore | S | **Done** | — | #16 |

**Suggested batch:** `SP-311` and `SP-312` are disjoint scope — may run in parallel after preflight.

#### Phase 38 — GitHub issue fixes (#18, #19)

**Source:** Open issues [#18](https://github.com/beettlle/pi-spine/issues/18) (worker exit without `.DONE` misdiagnosed as orphan), [#19](https://github.com/beettlle/pi-spine/issues/19) (stall_timeout on long operator matrix tasks).

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-313 | Worker exit without .DONE diagnosis | M | **Done** | — | #18 |
| SP-314 | Contract stall timeout override | M | **Done** | — | #19 |

**Suggested batch:** `SP-313` and `SP-314` are disjoint scope — may run in parallel after preflight.

#### Phase 39 — GitHub issue fixes (#20, #21, #22)

**Source:** Open issues [#20](https://github.com/beettlle/pi-spine/issues/20) (engine_orphaned retry limbo), [#21](https://github.com/beettlle/pi-spine/issues/21) (attached SIGTERM post-merge land loop), [#22](https://github.com/beettlle/pi-spine/issues/22) (integrate blocked by rules-manifest drift).

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-315 | Engine orphan retry recovery | M | **Staged** | — | #20 |
| SP-316 | Attached post-merge SIGTERM land loop | M | **Staged** | — | #21 |
| SP-317 | Integrate rules-manifest drift handling | S | **Staged** | — | #22 |

**Suggested batch:** `SP-315`, `SP-316`, `SP-317` overlap `src/batch/` — plan serializes in lane 1; SP-317 may run after SP-315/316 or in parallel if scope stays disjoint.

#### Phase 40 — Atomic artifact writes (Gemma import #4)

**Source:** Gemma concurrent demo research — crash-safe tmp+rename for orchestration truth files.

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-318 | Shared atomic write utility | S | **Staged** | — |
| SP-319 | Atomic batch-state and gate writes | S | **Staged** | SP-318 |
| SP-320 | Atomic evidence and salvage writes | S | **Staged** | SP-318 |
| SP-321 | Atomic worker-output and .DONE | S | **Staged** | SP-318 |

**Suggested batch:** `SP-318` first, then `SP-319`/`SP-320`/`SP-321` in parallel if scopes stay disjoint.

#### Phase 41 — Macro-phase labeling (Gemma import #3)

**Source:** Operator UX — single lifecycle macro-phase distinct from diagnosis and lane activityPhase.

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-322 | deriveMacroPhase module | S | **Staged** | — |
| SP-323 | Macro-phase in reconcile and CLI | S | **Staged** | SP-322 |
| SP-324 | Dashboard macro-phase in batch summary | S | **Staged** | SP-322 |

**Suggested batch:** `SP-322` then `SP-323`/`SP-324` in parallel.

#### Phase 42 — Per-lane throughput dashboard (Gemma import #2)

**Source:** Task-based lane productivity (elapsed, done count, tasks/hr) — not LLM token/tps.

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-325 | Task metrics laneNumber and durationMs | S | **Staged** | — |
| SP-326 | Per-lane stats derivation module | S | **Staged** | SP-325 |
| SP-327 | Dashboard lane throughput columns | S | **Staged** | SP-326 |
| SP-328 | Dashboard throughput contract tests | S | **Staged** | SP-327 |

**Suggested batch:** serial chain `SP-325` → `SP-326` → `SP-327` → `SP-328`.

#### Phase 43 — Scenario/recipe registry (Gemma import #1)

**Source:** Centralize incident/stub/adoption fixtures; operator `spine scenarios` CLI.

| Task | Summary | Size | Status | Deps |
|------|---------|------|--------|------|
| SP-329 | Scenario registry schema and module | S | **Staged** | — |
| SP-330 | Populate scenario registry entries | S | **Staged** | SP-329 |
| SP-331 | Centralize scenario materialize helpers | S | **Staged** | SP-329, SP-330 |
| SP-332 | spine scenarios CLI | S | **Staged** | SP-329 |
| SP-333 | Adoption smoke recipe and registry docs | S | **Staged** | SP-332 |

**Suggested batch:** `SP-329` → `SP-330`/`SP-332` → `SP-331`/`SP-333`.

**Serial constraint:** Phase 40–42 overlap `src/batch/` with Phase 39 (`SP-315`–`SP-317`) — interleave carefully or finish Phase 39 first.

#### Phase 44 — GitHub issue fixes (#25–#38)

**Source:** Open issues [#25](https://github.com/beettlle/pi-spine/issues/25) through [#38](https://github.com/beettlle/pi-spine/issues/38).

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-334 | Batch retry failed-phase recovery | S | **Staged** | — | #25 |
| ~~SP-335~~ | Batch complete worktree cleanup | M | **Retired** (superseded → SP-350/351) | — | #26 |
| SP-336 | Dashboard heartbeat display fix | S | **Staged** | — | #27 |
| SP-337 | Dismiss orphan worker kill | S | **Staged** | — | #28 |
| SP-338 | Merge failure diagnosis | S | **Staged** | — | #29 |
| SP-339 | Status JSON task progress | S | **Staged** | — | #30 |
| ~~SP-340~~ | Planner file-scope overlap guard | M | **Retired** (superseded → SP-352/353) | — | #31 |
| SP-341 | Worker timeout heartbeat slide | S | **Staged** | — | #32 |
| ~~SP-342~~ | Stub release task guard | M | **Retired** (superseded → SP-349) | — | #33 |
| SP-343 | Attached batch exit after complete | S | **Staged** | — | #34 |
| SP-344 | doneOnDisk semantics alignment | S | **Staged** | SP-338 | #35 |
| SP-345 | Transient orphan debounce | S | **Staged** | — | #36 |
| ~~SP-346~~ | Merge PRD conflict resolution | M | **Retired** (superseded → SP-354/355) | SP-310 | #37 |
| ~~SP-347~~ | Merge blocked terminal phase | M | **Retired** (superseded → SP-356/357) | SP-338 | #38 |

#### Phase 45 — Issue-fix decomposition (#26/#31/#37/#38 splits + #33/#39/#40)

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-349 | Stub contract enforcement | M | **Staged** | — | #33, #40 |
| SP-350 | Worktree cleanup on complete/dismiss | S | **Staged** | — | #26 (partial) |
| SP-351 | Doctor stale-worktrees check | S | **Staged** | SP-350 | #26 |
| SP-352 | Planner overlap detection module | S | **Staged** | — | #31 (partial) |
| SP-353 | Planner overlap plan warnings | S | **Staged** | SP-352 | #31 |
| SP-354 | Merge PRD auto-resolution | S | **Staged** | SP-310 | #37 (partial) |
| SP-355 | Preflight orch conflict warn | S | **Staged** | SP-310 | #37 |
| SP-356 | Merge blocked phase FSM | S | **Staged** | SP-338 | #38 (partial) |
| SP-357 | Attached merge failure exit | S | **Staged** | SP-356 | #38 |
| SP-348 | Post-merge limbo regression fix | S | **Done** | SP-316 | #39 |
| SP-358 | Detached start land loop finalize | M | **Staged** | SP-348, SP-359 | #41 |
| SP-359 | Resume contract review before commit | M | **Staged** | — | #42 |

**Execution order (updated 2026-06-29):** **SP-359** (#42 resume review bypass) must land before re-running **SP-358**; then wave-1 tasks gated on SP-358.

| Wave | Tasks | Rationale |
|------|-------|-----------|
| 0 | **SP-358** | Gatekeeper — detached start must open integrate gate without manual finalize |
| 1 | SP-352, SP-355, SP-336, SP-343, SP-354 + lifecycle cluster (SP-334, SP-337, SP-338, SP-339, SP-341, SP-345, SP-350) | Prevention (planner/preflight/merge PRD) + batch recovery; SP-343 after SP-358 (`attached-runner.mjs`) |
| 2 | SP-353, SP-351, SP-344, SP-356 | Planner warnings, worktree doctor, diagnosis/FSM |
| 3 | SP-357 | Attached merge-failure exit (needs SP-356 + SP-358) |

**Suggested commands:**
```bash
spine batch start SP-358                    # wave 0 — run first, real pi
spine batch start SP-352 SP-355 SP-336      # wave 1 subset — merge prevention (parallel)
spine batch start SP-343                    # attached land-loop UX
spine batch start pending                   # remainder after wave 0 lands
```

**Superseded (retired 2026-07-04 — do not batch):** SP-335, SP-340, SP-342, SP-346, SP-347 — replaced by SP-350–357 / SP-349 (all `.DONE`).

**Done:** SP-348, SP-349.

#### Phase 46 — Operator monitoring toolkit (#43)

**Source:** [Epic #43](https://github.com/beettlle/pi-spine/issues/43) — replace ad-hoc monitor scripts with first-class CLI surfaces (NFR-OBS-04).

**Explore:** [`spine-tasks/_explore/operator-observability-stream/findings.md`](_explore/operator-observability-stream/findings.md) (2026-06-29, complete — deferred Tier 3 agent stream per #52)

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-339 | Status JSON task progress | S | **Staged** | — | #30 |
| SP-360 | `spine watch` | S | **Staged** | — | #44 |
| SP-361 | `spine journal follow` | S | **Staged** | — | #45 |
| SP-362 | `spine wait` | S | **Staged** | SP-360 | #46 |
| SP-363 | Operator monitoring runbook | S | **Staged** | SP-339, SP-360, SP-361, SP-362 | #47 |
| SP-364 | `lane.progress_snapshot` events | M | **Staged** | — | #48 |
| SP-365 | Live lane worker log | M | **Staged** | — | #49 |
| SP-366 | `spine lane logs` CLI | S | **Staged** | SP-365 | #50 |
| SP-367 | Dashboard lane detail panel | M | **Staged** | SP-364, SP-365 | #51 |
| SP-368 | Deferred observability stream explore | L | **Done** | — | #52 |

**Suggested batch waves:**

| Wave | Tasks | GitHub |
|------|-------|--------|
| 0 | SP-339, SP-360, SP-361 | #30, #44, #45 |
| 1 | SP-362, SP-363 | #46, #47 |
| 2 | SP-364, SP-365 | #48, #49 |
| 3 | SP-366, SP-367 | #50, #51 |
| Explore | SP-368 | #52 |

```bash
spine tasks validate SP-360 SP-361 SP-362 SP-363 SP-364 SP-365 SP-366 SP-367 SP-368
spine batch start SP-339 SP-360 SP-361    # wave 0
spine batch start SP-362 SP-363           # wave 1
spine batch start SP-364 SP-365           # wave 2
spine batch start SP-366 SP-367           # wave 3
spine batch start SP-368                  # explore doc (parallel anytime)
```

#### Phase 47 — GitHub open issues (#53–#59)

**Source:** Open issues on [beettlle/pi-spine](https://github.com/beettlle/pi-spine/issues) as of 2026-06-30. Epic **#43** already tracked by Phase 46 (SP-339–SP-368).

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-369 | Reviewer per-type model resolution helpers | S | **Staged** | — | — |
| SP-370 | Wire per-type reviewer model into spawn | S | **Staged** | SP-369 | — |
| SP-371 | Reviewer model settings and doctor | S | **Staged** | SP-370 | — |
| SP-372 | Reviewer model observability and docs | S | **Staged** | SP-371 | #53 |
| SP-373 | Contract verify pre-landed scope satisfaction | S | **Staged** | — | — |
| SP-374 | Preflight warn stale fileScopeMustChange | S | **Staged** | SP-373 | #56 |
| SP-375 | Attached engine honors pause signal | S | **Staged** | — | — |
| SP-376 | Pause fail-loud and retry guard | S | **Staged** | SP-375 | #57 |
| SP-377 | Post-merge limbo regression fixture | S | **Staged** | SP-358 | — |
| SP-378 | Attached merge finalize before engine exit | S | **Staged** | SP-377, SP-348 | #59 |
| SP-379 | Lane queue snapshot helpers | S | **Staged** | — | — |
| SP-380 | Dashboard Running and Queued columns | S | **Staged** | SP-379 | — |
| SP-381 | Dashboard batch assignment task states | S | **Staged** | SP-379 | — |
| SP-382 | Dashboard batch summary task counts | S | **Staged** | SP-379 | — |
| SP-383 | Lane queue dashboard tests and docs | S | **Staged** | SP-380–382 | — |
| SP-384 | Status JSON lane queue parity | S | **Staged** | SP-379, SP-383 | #58 |
| SP-385 | Batch start `--wave` filter | S | **Staged** | — | — |
| SP-386 | Format plan wave command hint | S | **Staged** | SP-385 | — |
| SP-387 | Sequence runner core loop | S | **Staged** | SP-385 | — |
| SP-388 | `spine run sequence` CLI | S | **Staged** | SP-387 | — |
| SP-389 | Sequence state persistence and resume | S | **Staged** | SP-388 | — |
| SP-390 | Sequence auto-approve gate safety | S | **Staged** | SP-387 | — |
| SP-391 | Sequence journal events | S | **Staged** | SP-387 | — |
| SP-392 | Sequence diagnose and dashboard surfaces | S | **Staged** | SP-389, SP-391 | #54 |
| SP-393 | Sequence supervisor daemon explore | L | **Staged** | SP-392 | — |
| SP-398 | Contract comma-in-backtick path parse fix | S | **Staged** | — | #61 |

**Suggested batch waves:**

| Wave | Tasks | GitHub | Notes |
|------|-------|--------|-------|
| A (parallel) | SP-369, SP-373, SP-375, SP-379, SP-385, SP-398 | #53, #56, #57, #58, #54, #61 | Disjoint roots |
| B (serial) | SP-370 → SP-374 → SP-376; SP-380 → SP-381 → SP-382; SP-386; SP-387 | | Dashboard/sequence file-scope chains |
| C (parallel) | SP-371, SP-377, SP-383, SP-388, SP-390 | | |
| D (parallel) | SP-372, SP-378, SP-384, SP-389, SP-391, SP-392 | #53, #59, #58, #54 | SP-391 after SP-390 |
| Explore | SP-393 | #54 Tier 3 | After SP-392 |

```bash
spine tasks validate pending
spine tasks analyze pending
spine plan SP-369 SP-373 SP-375 SP-379 SP-385   # wave A
spine batch start SP-369 SP-373 SP-375 SP-379 SP-385
```

#### Phase 48 — Upstream issue filing (#60)

**Source:** [GitHub #60](https://github.com/beettlle/pi-spine/issues/60) — GitHub issue templates + `spine issue draft` CLI for labeled upstream bug/feature reports. Parallel to Phase 47; does not block #53–#59.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-394 | GitHub issue templates (`bug` / `enhancement` labels) | S | **Staged** | — | partial #60 |
| SP-395 | Issue draft body assembly module | S | **Staged** | — | — |
| SP-396 | `spine issue draft` CLI + optional `--create` | S | **Staged** | SP-395 | — |
| SP-397 | Operator runbook + operator rule docs | S | **Staged** | SP-394, SP-396 | #60 |

**Suggested batch waves:**

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 (parallel) | SP-394, SP-395 | Disjoint roots; no spine code in SP-394 |
| 1 | SP-396 | After SP-395 |
| 2 | SP-397 | Docs + close #60 |

```bash
spine tasks validate SP-394 SP-395 SP-396 SP-397
spine plan SP-394 SP-395                    # wave 0 — parallel
spine batch start SP-394 SP-395
spine batch start SP-396
spine batch start SP-397
```

#### Phase 49 — Pre-1.2.0 release blockers (#64–#66)

**Source:** Open GitHub bugs filed during batch `20260701T031142` operator session. Target: ship in **1.2.0** before npm publish.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-399 | Batch CLI `--help` routing | S | **Staged** | — | #64 |
| SP-400 | Batch start `--wave` positional parse fix | S | **Staged** | — | #65 |
| SP-401 | Merge blocked resume + skip succeeded waves | M | **Staged** | SP-356 | #66 |

**Suggested batch waves:**

| Wave | Tasks | Notes |
|------|-------|-------|
| 0 (parallel) | SP-399, SP-400 | Disjoint CLI roots (`bin/spine-batch.mjs`) — serialize if same file conflicts |
| 1 | SP-401 | Resume/merge recovery; run after wave 0 lands |

**Effort estimate (from code paths):** ~5–8 h total — SP-399 ~1–2 h, SP-400 ~1–2 h, SP-401 ~3–5 h.

```bash
spine tasks validate SP-399 SP-400 SP-401
spine plan SP-399 SP-400 SP-401
spine batch start SP-399 SP-400   # wave 0 (or serial: SP-399 then SP-400)
spine batch start SP-401          # wave 1
```

#### Phase 50 — Pre-1.2.0 attached evidence gate (#70)

**Source:** GitHub #70 — gate not opened when attached CLI killed during evidence test collection (batch `20260701T170610`).

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-402 | Attached evidence gate resilience | M | **Staged** | — | #70 |

```bash
spine tasks validate SP-402
spine batch start SP-402 --attached
```

#### Phase 51 — GitHub open issues (#62, #63, #67, #68)

**Source:** Open issues on [beettlle/pi-spine](https://github.com/beettlle/pi-spine/issues) as of 2026-07-01. Epic **#43** already tracked by Phase 46 (SP-339–SP-368); child issues #30, #44–#52 are closed — finish remaining Phase 46 staged tasks, then close epic #43 manually.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-403 | Tail-state diagnosis headline | S | **Staged** | — | #68 (partial) |
| SP-404 | Dashboard banner tail macro-phase | S | **Staged** | SP-403 | #68 (partial) |
| SP-405 | Wave panel terminal completed | S | **Staged** | SP-379 | #68 (partial) |
| SP-406 | Dashboard tail activity subline | S | **Staged** | SP-403–405 | #68 |
| SP-407 | Stub delivery-only scope detector | S | **Staged** | — | #67 (partial) |
| SP-408 | Stub runner STATUS.md delivery | S | **Staged** | SP-407 | #67 (partial) |
| SP-409 | Stub delivery runbook | S | **Staged** | SP-408 | #67 |
| SP-410 | Contract template parallel semantics | S | **Staged** | SP-398 | #63 (partial) |
| SP-411 | Skill must-not-change guidance | S | **Staged** | SP-410 | #63 (partial) |
| SP-412 | Runbook must-not-change failures | S | **Staged** | SP-410, SP-409 | #63 (partial) |
| SP-413 | Validate spine-tasks must-not warn | S | **Staged** | SP-410–412 | #63 |
| SP-414 | Contract verify scoped diff API | S | **Staged** | — | #62 (partial) |
| SP-415 | Resolve task start commit | S | **Staged** | — | #62 (partial) |
| SP-416 | Serialized lane scoped verify | M | **Staged** | SP-414, SP-415 | #62 (partial) |
| SP-417 | Close #62 serialized lane verify | S | **Staged** | SP-416, SP-409, SP-412 | #62 |

**Suggested batch waves:**

| Wave | Tasks | GitHub | Notes |
|------|-------|--------|-------|
| A (parallel) | SP-403, SP-405, SP-407, SP-410, SP-414, SP-415 | #68, #67, #63, #62 | Disjoint roots |
| B (parallel) | SP-404, SP-408, SP-411, SP-412 | | Docs chains after wave A |
| C | SP-416 | #62 | Scoped verify wiring |
| D (parallel) | SP-406, SP-409, SP-413, SP-417 | #68, #67, #63, #62 | Issue close capstones |

```bash
spine tasks validate SP-403 SP-404 SP-405 SP-406 SP-407 SP-408 SP-409 SP-410 SP-411 SP-412 SP-413 SP-414 SP-415 SP-416 SP-417
spine tasks analyze pending
spine plan SP-403 SP-405 SP-407 SP-410 SP-414 SP-415   # wave A
spine batch start SP-403 SP-405 SP-407 SP-410 SP-414 SP-415
```

#### Phase 52 — GitHub open issues (#71–#96)

**Source:** Open issues on [beettlle/pi-spine](https://github.com/beettlle/pi-spine/issues) as of 2026-07-02. **Policy:** documentation first; then **1 enhancement per 3 bugs** in suggested waves. Epic **#43** remains Phase 46 (SP-339–SP-368 staged). **#92** is a tracking summary — no implementation task. **#79** flag exposure is SP-431 (safety gates remain SP-390).

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-418 | Agent outer loop how-to doc | S | **Staged** | — | #90 (partial) |
| SP-419 | Spine-orchestrate skill + slash | M | **Superseded** | SP-418 | → SP-466, SP-467 |
| SP-420 | Cross-model PROMPT authoring docs | S | **Staged** | — | #84 |
| SP-421 | Diagnosis primary failure class | S | **Staged** | — | #74 |
| SP-422 | Doctor canonical model ids | S | **Staged** | — | #76 |
| SP-423 | Sequence preflight `.pi/` + errors | S | **Staged** | — | #81 |
| SP-424 | Limbo-detect leaf (#83-A) | S | **Done** | — | — |
| SP-425 | Contract failed terminal path | M | **Staged** | SP-421 | #85 |
| SP-426 | Contract verify maxBuffer | S | **Complete** | — | #86 |
| SP-427 | Dirty worktree coverage hygiene | M | **Complete** | — | #73 |
| SP-428 | Resume validation + detached spawn leaves (#83-B/C) | M | **Superseded** | SP-424 | → SP-468, SP-469 |
| SP-429 | Dirty worktree symlink drift | S | **Complete** | — | #87 |
| SP-430 | Gitignored dirty worktree fix | M | **Superseded** | SP-427 | → SP-470, SP-471 |
| SP-431 | Sequence `--auto-approve-gate` flag | S | **Complete** | SP-390 | #79 |
| SP-432 | Import cycle arch guard (#83-D/E) | S | **Staged** | SP-469 | #83 |
| SP-433 | Resume force skip succeeded tasks | M | **Done** | — | #88 |
| SP-434 | Attached engine single-owner lock | M | **Done** | — | #89 |
| SP-435 | Sequence detached false failure exit | S | **Staged** | SP-388 | #72 |
| SP-436 | Isolated base integrate core (#91 slice 1) | M | **Superseded** | — | → SP-474, SP-475 |
| SP-437 | Sequence continue after merge_blocked | S | **Complete** | SP-387 | #82 |
| SP-438 | Flutter worktree adoption docs | S | **Done** | SP-420 | #78/#80 (partial) |
| SP-439 | Integrate false merge conflict | M | **Staged** | — | #93 |
| SP-440 | Supervisor spawn MVP (#71 slice 1) | M | **Complete** | — | — |
| SP-441 | Batch complete stale batch-state | S | **Done** | — | #94 |
| SP-442 | Skip clears failed segment | M | **Staged** | SP-401 | #96 |
| SP-443 | Isolated integrate sync-base + doctor | M | **Superseded** | SP-436 | → SP-476, SP-477 |
| SP-444 | Supervisor config doctor + docs | S | **Staged** | SP-440 | #71 |

**Suggested batch waves (docs first; 3 bugs : 1 enhancement):**

| Wave | Tasks | Mix |
|------|-------|-----|
| **0 (docs)** | SP-418 → SP-420 (serial: shared `operator-runbook.md`) | 2 documentation |
| **1 (docs)** | SP-419, SP-438 | 1 doc delivery + 1 adoption doc (deps SP-418, SP-420) |
| **2** | SP-421, SP-422, SP-423, SP-424 | 3 bugs + 1 enhancement (#83) |
| **3** | SP-425, SP-426, SP-427, SP-428 | 3 bugs + 1 enhancement (#83) |
| **4** | SP-429, SP-430, SP-431, SP-432 | 3 bugs + 1 enhancement (#83 close) |
| **5** | SP-433, SP-434, SP-435, SP-436 | 3 bugs + 1 enhancement (#91) |
| **6** | SP-437, SP-439, SP-441, SP-440 | 3 bugs + 1 enhancement (#71) |
| **7** | SP-442, SP-443, SP-444 | 1 bug + 2 enhancement closeouts |

```bash
spine tasks validate SP-418 SP-419 SP-420 SP-421 SP-422 SP-423 SP-424
spine tasks analyze pending
spine plan SP-418                    # wave 0a — doc first
spine batch start SP-418
spine batch start SP-420               # wave 0b — cross-model docs (after SP-418)
spine batch start SP-419 SP-438               # wave 1 — docs delivery
spine batch start SP-421 SP-422 SP-423 SP-424  # wave 2

#### Phase 53 — Batch reliability (#100, #103, #104) + recovery blockers (#85, #96)

**Source:** Dogfood batch `20260702T153101` recovery pain. Fix FSM/reconcile/dashboard before resuming Phase 52 tail. **Policy:** land Phase 53 on `main` locally (no PRs required); then fresh batch for remaining Phase 52 tasks.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-445 | doneInLane drift detection | M | **Staged** | — | #100 (partial) |
| SP-446 | Diagnosis for doneInLane pending drift | M | **Staged** | SP-445 | #100 (partial) |
| SP-447 | Dashboard truth for engine_orphaned/drift | M | **Staged** | SP-446 | #100 |
| SP-448 | Resume lane heartbeat refresh | S | **Staged** | — | #100 (partial) |
| SP-449 | Attached pause phase persistence | M | **Staged** | SP-376 | #103 |
| SP-450 | Pi extension conflict doctor + worker guard | M | **Complete** | — | #104 |
| SP-425 | Contract failed terminal path | M | **Complete** | SP-421 | #85 |
| SP-442 | Skip clears failed segment | M | **Staged** | SP-401 | #96 |

**Suggested waves (run after aborting stuck batch `20260702T153101`):**

| Wave | Tasks | Notes |
|------|-------|-------|
| **R0 (recovery FSM)** | SP-449, SP-442 | Pause/skip unblock; parallel if file scopes disjoint |
| **R1 (#100 core)** | SP-445 → SP-446 → SP-447 | Serial chain; SP-448 parallel with R1 |
| **R2 (worker hygiene)** | SP-450, SP-425 | Extension conflicts + contract_failed path |

```bash
# Validate and plan
spine tasks validate SP-445 SP-446 SP-447 SP-448 SP-449 SP-450 SP-425 SP-442
spine tasks analyze pending
spine plan SP-449 SP-442 SP-448 SP-450

# Wave R0 — recovery (stub CI first, then real pi)
SPINE_WORKER_STUB=1 spine batch start SP-449 SP-442
# After land on main:
spine batch start SP-445
spine batch start SP-446
spine batch start SP-447
spine batch start SP-448 SP-450 SP-425   # parallel where plan allows
```

#### Phase 54 — GitHub open issues (#97–#113)

**Source:** Open issues on [beettlle/pi-spine](https://github.com/beettlle/pi-spine/issues) as of 2026-07-02. **#92** remains tracking-only (no task). **Execution policy:** Tier 1 documentation → Tier 2 performance (#98) → Tier 3 **3 bugs : 1 feature** rotation across remaining backlog.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-451 | Journal read cache | S | **Staged** | — | #98 (partial) |
| SP-452 | Orchestrator poll interval defaults | S | **Staged** | — | #98 (partial) |
| SP-453 | Dashboard shared reconcile snapshot | M | **Staged** | SP-451 | #98 (partial) |
| SP-454 | Orchestrator process model docs | S | **Staged** | SP-451–453 | #98 |
| SP-455 | Heartbeat git porcelain debounce | S | **Staged** | SP-451 | #98 (partial) |
| SP-456 | Reconcile batch light mode | M | **Staged** | SP-452 | #98 (partial) |
| SP-457 | Graphify hook spine batch doc | S | **Complete** | — | #113 (partial) |
| SP-458 | Flutter lane analyzer hygiene | M | **Staged** | SP-438 | #78 |
| SP-459 | Gitignored asset worktree hook | S | **Staged** | SP-438 | #80 |
| SP-460 | Doctor inherit provider auth probe | M | **Staged** | SP-422 | #97 |
| SP-461 | Contract verify resume baseline | M | **Superseded** | SP-415, SP-416 | → SP-478, SP-479 |
| SP-462 | Contract scope base satisfied | S | **Staged** | SP-478 | #105 |
| SP-463 | Graphify-out dirty check exclusion | S | **Staged** | SP-471 | #113 |
| SP-464 | Plan pending empty backlog UX | S | **Staged** | — | #99 |
| SP-465 | Batch size guidance wording | S | **Staged** | — | #106 |

**Suggested execution order (global backlog):**

| Tier | Wave | Tasks | Notes |
|------|------|-------|-------|
| **1 Docs** | D0 | SP-418 → SP-420 | Serial (`operator-runbook.md`) |
| | D1 | SP-466→467, SP-438, SP-363 | #90, #78/#80 partial, #47 |
| | D2 | SP-457 | #113 partial doc |
| **2 Perf** | P0 | SP-451, SP-452 | Parallel |
| | P1 | SP-453 | After SP-451 |
| | P2 | SP-454, SP-455 | Docs + debounce |
| | P3 | SP-456 | After SP-452 |
| **3 Rotation** | C1 | SP-449, SP-442, SP-460 → **SP-464** | 3 bugs + #99 feature |
| | C2 | SP-445→446→447, SP-448 → **SP-465** | #100 chain + #106 |
| | C3 | SP-463, SP-470→471, SP-478 → **SP-432** | #113, #95, #105 + #83 |
| | C4 | SP-462, SP-435, SP-441 → **SP-474→475** | #105, #72, #94 + #91 |
| | C5 | SP-437, SP-439, SP-458 → **SP-440** | #82, #93, #78 + #71 |
| | C6 | SP-459, SP-476→477, **SP-444** | #91 closeouts |

```bash
spine tasks validate SP-451 SP-452 SP-453 SP-454 SP-455 SP-456 SP-457 SP-458 SP-459 SP-460 SP-461 SP-462 SP-463 SP-464 SP-465
spine tasks analyze pending
spine plan SP-418
spine plan SP-451 SP-452
```

#### Phase 55 — Task size decomposition (2026-07-02)

**Source:** Batch size guidance warning on `spine plan pending` (16 M, 0 L). Resized 5 mis-sized M→S; split 6 composite parents into 12 children; split SP-461 into SP-478/479. Parents marked `.SUPERSEDED`.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-466 | Spine orchestrate skill package | S | **Done** | SP-418 | #90 (partial) |
| SP-467 | Spine orchestrate slash command | S | **Staged** | SP-418, SP-466 | #90 |
| SP-468 | Resume validation leaf (#83-B) | S | **Done** | SP-424 | #83 (partial) |
| SP-469 | Detached spawn leaf (#83-C) | S | **Staged** | SP-424, SP-468 | #83 (partial) |
| SP-470 | Gitignored index vs worktree detection | S | **Staged** | SP-427 | #95 (partial) |
| SP-471 | Gitignored auto-clean before dirty gate | S | **Staged** | SP-427, SP-470 | #95 |
| SP-474 | Integrate base branch snapshot | S | **Staged** | — | #91 (partial) |
| SP-475 | Integrate isolated merge path | M | **Staged** | SP-474 | #91 (partial) |
| SP-476 | Integrate config and doctor warnings | S | **Staged** | SP-475 | #91 (partial) |
| SP-477 | Integrate sync-base CLI and diagnoses | S | **Staged** | SP-475, SP-476 | #91 |
| SP-478 | Contract verify resume baseline | M | **Staged** | SP-415, SP-416 | #105 (partial) |
| SP-479 | Contract CLI friction fixes | S | **Staged** | SP-478 | #105 (partial) |

**Superseded parents:** SP-419, SP-428, SP-430, SP-436, SP-443, SP-461

```bash
spine tasks validate SP-466 SP-467 SP-468 SP-469 SP-470 SP-471 SP-474 SP-475 SP-476 SP-477 SP-478 SP-479
spine tasks analyze pending
spine plan SP-418 SP-466 SP-467
```

#### Phase 56 — Worker conditional -ne (2026-07-02)

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-480 | Worker conditional pi -ne for extension conflicts | S | **Complete** | SP-450 | — |

```bash
spine tasks validate SP-480
spine preflight
spine batch start SP-480
```

#### Phase 57 — v1.4.0 issue fixes (#118, #132, #133)

**Source:** Issues identified for v1.4.0 release. #95 already covered by SP-470/471.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-488 | Contract failed false positive docs | S | **Complete** | SP-494 | #132 |
| SP-489 | Dashboard failed task highlights | S | **Complete** | — | #133 |
| SP-490 | Contract trailing-slash match | S | **Complete** | — | #118 |

**Suggested batch (all parallel — disjoint file scope):**

```bash
spine tasks validate SP-488 SP-489 SP-490
spine tasks analyze SP-488 SP-489 SP-490
spine plan SP-488 SP-489 SP-490
spine batch start SP-488 SP-489 SP-490
```

#### Phase 58 — v1.5.0 prep (2026-07-04)

**Source:** v1.5.0 release planning — new P0 task packets, skill P0 fixes, closed-issue audit, superseded task retirement.

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-494 | Stet contract integration (v1.5.0 bootstrap) | S | **Complete** | — | — |
| SP-491 | Contract verify worker env isolation | M | **Complete** | SP-494 | #155 |
| SP-492 | Skill fileScopeMustChange for docs-only | S | **Complete** | SP-494 | #139 |
| SP-493 | Skill two-deliverable split test | S | **Complete** | SP-492, SP-494 | #140 |
| SP-437 | Sequence continue after merge_blocked wave | S | **Complete** | SP-387, SP-494 | #82 |
| SP-471 | Gitignored auto-clean before dirty gate | S | **Complete** | SP-427, SP-470, SP-494 | #95 |

**Stet batch policy (v1.5.0):**

- **Prerequisite:** LM Studio server at `http://127.0.0.1:1234/v1` with `qwen/qwen3-coder-next` loaded; `stet doctor` exits 0.
- **Integration:** Option A — `worktreeSetupHook` + contract `testCommand` (`docs/stet-overview.md` §1).
- **Bootstrap:** SP-494 must complete before v1.5.0 implementation batches.
- **Review scope:** Code files only; non-code excluded via `.review/config.toml` `exclude_patterns`.
- **Contract:** `stet run --auto-finish-zero --quiet` chained after tests; error-severity findings fail contract.

**Stet findings → GitHub issues:**

When stet reports findings the worker cannot fix in-task:

1. **Project code defects** → open issues on **beettlle/pi-spine** with label `stet` (title: `[stet] <summary> (<file>:<line>)`; body: task id, finding id, file, line, severity, category, message). Use `gh issue create` or `scripts/spine-stet-file-issues.sh`.
2. **stet CLI / tooling bugs** → https://github.com/beettlle/stet/issues (attach `stet doctor` output + config, redact secrets).
3. Do **not** `stet dismiss` to pass contract without fix + issue or documented reason in `STATUS.md`.

**Suggested batch (revised for stet):**

```bash
# Wave 0 — bootstrap (serial)
spine tasks validate SP-494
spine batch start SP-494

# Wave 1 — after SP-494 lands
spine tasks validate SP-492 SP-493 SP-491 SP-437 SP-471 SP-488
spine plan SP-492 SP-493 SP-491
spine batch start SP-492          # skill #139 — then SP-493 (shared SKILL.md; serial)
spine batch start SP-493          # after SP-492
spine batch start SP-491          # P0 bug #155 — disjoint scope; parallel when lanes allow
# SP-437, SP-471, SP-488 per existing deps when ready
```

**Previous suggested batch (superseded by stet wave order above):**

```bash
spine tasks validate SP-491 SP-492 SP-493
spine tasks analyze SP-492 SP-493 SP-491
spine plan SP-492 SP-493 SP-491
spine batch start SP-492          # skill #139 — then SP-493 (shared SKILL.md; serial)
spine batch start SP-493          # after SP-492
spine batch start SP-491          # P0 bug #155 — disjoint scope; parallel with SP-492 wave if lanes allow
```

**Closed-issue audit (open packets referencing closed GitHub issues):**

| Task | Issue | Issue state | Marker | Disposition |
|------|-------|-------------|--------|-------------|
| SP-282 | #5 | CLOSED | `.SUPERSEDED` | **Retired** — use SP-294/295 (done) |
| SP-284 | #7 | CLOSED | `.SUPERSEDED` | **Retired** — use SP-296/297 (done) |
| SP-292 | #11 | CLOSED | `.SUPERSEDED` | **Retired** — use SP-298/299 (done) |
| SP-335 | #26 | CLOSED | `.SUPERSEDED` | **Retired** — use SP-350/351 (done) |
| SP-340 | #31 | CLOSED | `.SUPERSEDED` | **Retired** — use SP-352/353 (done) |
| SP-342 | #33 | CLOSED | `.SUPERSEDED` | **Retired** — use SP-349 (done) |
| SP-346 | #37 | CLOSED | `.SUPERSEDED` | **Retired** — use SP-354/355 (done) |
| SP-347 | #38 | CLOSED | `.SUPERSEDED` | **Retired** — use SP-356/357 (done) |
| SP-419 | #90 | OPEN | `.SUPERSEDED` | **Superseded** — execute SP-466/467 |
| SP-430 | #95 | CLOSED | `.SUPERSEDED` | **Superseded** — finish SP-471 |
| SP-437 | #82 | CLOSED | none | **Complete** — integrated to `main` (batch 20260704T185602) |
| SP-471 | #95 | CLOSED | none | **Complete** — integrated to `main` (batch 20260704T185602) |
| SP-488 | #132 | CLOSED | none | **Complete** — integrated to `main` (batch 20260704T185602) |

**Superseded SP-2xx/3xx retirement (2026-07-04):** SP-282, SP-284, SP-292, SP-335, SP-340, SP-342, SP-346, SP-347 already have `.SUPERSEDED` markers and completed successors. Planner excludes them from `spine plan pending`. Do not re-batch; use replacement task IDs above.

**v1.5.0 release:** Shipped as npm `pi-spine@1.5.0` (tag `v1.5.0`). Batches: `20260704T182954` (SP-494), `20260704T185602` (wave 1), `20260704T205637` (SP-493).

**Next (stet feedback loop):** v1.5.0 contract path auto-finishes zero-finding sessions, so `.review/history.jsonl` is absent until dismissals occur. Audit and next-release proposals: `docs/features/stet-feedback-loop-brief.md`.

#### Phase 59 — v1.8.1 reconciliation epic (SP-REC)

**Source:** [`docs/PRD-v1.8.1-reconciliation-handoff.md`](../docs/PRD-v1.8.1-reconciliation-handoff.md), [`docs/release/stabilization-roadmap-v1.8-v2.0.md`](../docs/release/stabilization-roadmap-v1.8-v2.0.md)

| Task | Summary | Size | Status | Deps | Closes |
|------|---------|------|--------|------|--------|
| SP-511 | Reconciliation v1.8.1 explore findings | S | **Staged** | — | — |
| SP-512 | Drift retry deadlock fix | S | **Staged** | SP-511 | #170 |
| SP-513 | Pause/resume SIGTERM engine orphan | S | **Staged** | SP-511 | #184 |
| SP-514 | v1.8.1 incident fixtures | S | **Staged** | SP-512, SP-513 | — |
| SP-515 | Macro phase active workers | S | **Staged** | SP-512 | #165 |
| SP-516 | Status classification alignment | S | **Staged** | SP-512 | #166 |
| SP-517 | Dashboard wave completed under drift | S | **Staged** | SP-512 | #186 |
| SP-518 | Attached SIGKILL orphan guard | S | **Staged** | — | #163 (Partial) |
| SP-519 | State drift recovery docs | S | **Staged** | SP-512 | #168 |
| SP-520 | CONTEXT Phase 59 capstone | S | **Staged** | SP-511–519 | — |
| SP-442 | Skip clears failed segment | M | **Staged** | SP-401 | #96 |
| SP-445 | doneInLane drift detection | M | **Staged** | — | #100 (Partial) |
| SP-446 | Diagnosis doneInLane pending | M | **Staged** | SP-445 | #100 (Partial) |
| SP-447 | Dashboard orphan truth | M | **Staged** | SP-446 | #100 (Partial) |
| SP-448 | Resume heartbeat refresh | S | **Staged** | — | #100 (Partial) |
| SP-449 | Attached pause phase persistence | M | **Staged** | SP-376 | #103 |

**Suggested batches (patch S-first):**

```bash
spine tasks validate SP-511 SP-512 SP-513 SP-514 SP-515 SP-516 SP-517 SP-518 SP-519 SP-520
spine plan SP-511
spine batch start SP-511
spine batch start SP-512
spine batch start SP-513
spine batch start SP-514 SP-515 SP-516 SP-518
spine batch start SP-517 SP-519
spine batch start SP-520
```

**Phase 59 exit criteria:** See handoff §10 — incident replay, actionable diagnose, open issues ≤ ~35.

**Future phases (handoffs only — tasks not yet authored):**

- Phase 60 — v1.9.0 contract guardrails: [`docs/PRD-v1.9.0-contract-guardrails-handoff.md`](../docs/PRD-v1.9.0-contract-guardrails-handoff.md)
- Phase 61 — v1.10.0 release harness: [`docs/PRD-v1.10.0-release-harness-handoff.md`](../docs/PRD-v1.10.0-release-harness-handoff.md)
- Phase 62 — v2.0.0 automation proof: [`docs/PRD-v2.0.0-automation-proof-handoff.md`](../docs/PRD-v2.0.0-automation-proof-handoff.md)

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
