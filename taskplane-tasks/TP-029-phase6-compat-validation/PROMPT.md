# Task: TP-029 — Phase 6 compatibility validation + v1 sign-off

**Created:** 2026-06-02
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Closes PRD Phase 6 — incident regression matrix, integration fixture, gap-list finalization, and dogfood report. May touch stall/progress helpers (`src/batch/heartbeat.mjs`) to fully close GAP-STALL-01 / I-01 / I-07.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-029-phase6-compat-validation/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Deliver **PRD §23 Phase 6 — Compatibility validation** so pi-spine can claim **v1 feature-complete** with evidence:

1. **Incident regression suite** — automated tests mapping **I-01–I-10** from [`docs/incidents/20260531-phase0-taskplane-batch.md`](../../docs/incidents/20260531-phase0-taskplane-batch.md) to pi-spine behavior (assert fixes hold; document any intentional deferrals).
2. **PRD §20.2 integration fixture** — three-task repo fixture (A independent, B depends A, C independent): plan waves `{A,C}` then `{B}`, two-lane stub batch, mixed-outcome guard, resume/retry path smoke.
3. **Gap list finalization** — update [`docs/compatibility/taskplane-gap-list.md`](../../docs/compatibility/taskplane-gap-list.md): close **GAP-STALL-01** when progress-aware stall + FR-WORK-10 signals are tested; add Phase 6 verification note.
4. **Dogfood report** — new [`docs/compatibility/phase6-dogfood-report.md`](../../docs/compatibility/phase6-dogfood-report.md): what was validated, test coverage matrix (I-01–I-10), manual pi-worker checklist (optional `SPINE_WORKER_STUB=0`), known deferrals for publish (npm, migrate CLI).
5. **Project hygiene** — sync stale docs (`taskplane-tasks/CONTEXT.md`, README slash-command table) so they reflect Phases 0–5 Done and Phase 6 in progress → Done.

**Out of scope (defer to TP-030+ / publish):** `spine migrate-from-taskplane`, `spine init --preset taskplane-compat`, `/spine-settings`, `/spine-deps`, npm publish, pi.dev listing, worker MCP tools (`spine_report_progress`).

**Success:** Phase 6 deliverables landed; gap list shows all dogfood gaps **Closed** or explicitly **Deferred** with rationale; **190+** tests green; dogfood report signed off in STATUS.

## Dependencies

- **TP-028** — Phases 0–5 feature baseline on `main`

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`
- `docs/compatibility/taskplane-gap-list.md`

**Tier 3:**
- `docs/PRD.md` — §20 Testing, §23 Phase 6, §18.4–18.8
- `docs/incidents/20260531-phase0-taskplane-batch.md` — I-01–I-10 table
- `tests/batch/reconcile.test.mjs`, `tests/batch/retry.test.mjs`, `tests/batch/abort.test.mjs`, `tests/batch/heartbeat.test.mjs`, `tests/batch/engine.test.mjs` — existing patterns
- `tests/fixtures/batch-state/limbo-stale-20260531T165700.json` — incident fixture
- `src/batch/heartbeat.mjs`, `src/batch/worker-host.mjs` — stall/progress signals

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `SPINE_WORKER_STUB=1 npm test` (default CI path)
- **Optional manual:** `SPINE_WORKER_STUB=0` + `pi` on PATH for dogfood report §Manual validation

## File Scope

- `tests/compat/incidents.test.mjs` (new)
- `tests/batch/integration-abc.test.mjs` (new — PRD §20.2)
- `tests/batch/heartbeat.test.mjs` (extend — stall false-positive / FR-WORK-10)
- `src/batch/heartbeat.mjs` (optional — file-scope mtime signal)
- `src/batch/worker-host.mjs` (optional — wire file-scope signal)
- `docs/compatibility/taskplane-gap-list.md`
- `docs/compatibility/phase6-dogfood-report.md` (new)
- `taskplane-tasks/CONTEXT.md`
- `README.md` (slash-command stub table only if still wrong)
- `taskplane-tasks/dependencies.json` (add TP-029 entry)

## Steps

### Step 0: Preflight

- [ ] Confirm Phases 0–5 tasks (TP-002–TP-028) have `.DONE` on `main`
- [ ] Read incident I-01–I-10 table and map each to existing test or gap
- [ ] Baseline: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — record count in STATUS

### Step 1: Incident regression matrix (I-01–I-10)

> **Plan-review checkpoint**

- [ ] Add `tests/compat/incidents.test.mjs` with one named test (or describe block) per incident **I-01–I-10**
- [ ] Each test must **assert pi-spine behavior** (not merely document Taskplane failure). Minimum expectations:

| ID | Assert (pi-spine) |
|----|-------------------|
| I-01 | Progress signals (STATUS mtime and/or lane commit) extend stall deadline past hard timeout (`computeStallDeadline` / worker-host poll) |
| I-02 | `spine batch retry` resets task + segment records; resume sees `pendingSegments > 0` |
| I-03 | `spine state validate` rejects corrupt batch-state; archive path documented |
| I-04 | `spine batch abort` writes `.spine/runtime/{batchId}/archive/batch-state.json` before clearing active state |
| I-05 | Wave merge blocked when any task `failed`/`pending`; `force-merge` override path exists |
| I-06 | Retry refused during active `executing`/`merging` (or documented `--takeover` deferral with test skip rationale) |
| I-07 | Stall logic uses filesystem progress signals; optional FR-WORK-10 file-scope mtime (Step 2) |
| I-08 | `generateBatchPostMortem` / evidence `summary.md` does not claim success when failures exist |
| I-09 | Document-only in dogfood report (execution policy §23.1) — test may assert CONTEXT/policy doc exists |
| I-10 | Review fail-closed: `runStepReview` stubFail → non-zero; worker stops when level > 0 |

- [ ] Reuse fixtures under `tests/fixtures/` where possible; add new JSON/git fixtures only when needed
- [ ] Test file header comments link each block to incident ID + PRD section

**Artifacts:**
- `tests/compat/incidents.test.mjs` (new)

### Step 2: PRD §20.2 ABC integration fixture + GAP-STALL-01

> **Code review checkpoint**

- [ ] Add `tests/batch/integration-abc.test.mjs`:
  - Tasks **A**, **B** (deps A), **C** (independent) in temp git repo
  - Plan: wave 0 `{A,C}`, wave 1 `{B}`
  - Stub batch: two lanes wave 0, sequential merge policy, wave 1 completes
  - Optional: simulate one lane stall/recovery path with short stall config + stub delay
- [ ] Close **GAP-STALL-01** in gap list when:
  - STATUS mtime + lane commit grace covered by tests, **and**
  - Either implement **FR-WORK-10** file-scope mtime as warning-only signal in `collectProgressSignals`, **or** document in gap list why mtime-only warning is deferred with test for STATUS+commit path
- [ ] Extend `tests/batch/heartbeat.test.mjs` with false-positive fixture: worker silent on tools but STATUS/commit updates → no stall kill before grace expires

**Artifacts:**
- `tests/batch/integration-abc.test.mjs` (new)
- `tests/batch/heartbeat.test.mjs` (modified)
- `src/batch/heartbeat.mjs` (modified, if implementing file-scope mtime)

### Step 3: Dogfood report + gap list + CONTEXT

- [ ] Create `docs/compatibility/phase6-dogfood-report.md`:
  - Scope: Phase 6 validation date, commit SHA, test count
  - Table: I-01–I-10 → test name → pass/fail/deferred
  - Manual checklist: preflight → plan → batch (stub + optional real pi) → status → gate → integrate → complete
  - **Known deferrals for v1.0 publish:** migrate CLI, preset init, npm/pi.dev, worker MCP tools
  - Sign-off line: "Phase 6 complete — ready for publish task"
- [ ] Update `docs/compatibility/taskplane-gap-list.md`:
  - GAP-STALL-01 → **Closed** (or **Deferred** with FR-WORK-10 note — must not stay Open without rationale)
  - Add **Phase 6 verification** row: regression suite + dogfood report links
- [ ] Update `taskplane-tasks/CONTEXT.md`:
  - Phase 6 section with TP-029 Done
  - Clear stale "Phase 4 Staged" / priority backlog
  - `Next Task ID: TP-030`
- [ ] Fix README slash-command table if it still lists implemented commands as stubs (`/spine-gate`, `/spine-integrate`, pause/resume/retry)

**Artifacts:**
- `docs/compatibility/phase6-dogfood-report.md` (new)
- `docs/compatibility/taskplane-gap-list.md`
- `taskplane-tasks/CONTEXT.md`
- `README.md` (if needed)

### Step 4: Verification

- [ ] Full suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — record final count (**190+** target)
- [ ] `node bin/spine.mjs plan pending --json` — sanity on repo task graph
- [ ] Manual smoke checklist in STATUS (dashboard optional)
- [ ] Confirm TP-029 in `taskplane-tasks/dependencies.json` with dep `TP-028`

## Completion Criteria

- [ ] `tests/compat/incidents.test.mjs` covers I-01–I-10 with asserted pi-spine behavior
- [ ] PRD §20.2 ABC integration test passes in CI
- [ ] GAP-STALL-01 closed or explicitly deferred with tests for implemented stall signals
- [ ] `docs/compatibility/phase6-dogfood-report.md` published
- [ ] Gap list + CONTEXT reflect Phase 6 complete
- [ ] Full test suite green; no regressions to reconciliation, preflight, planner, batch engine

## Must Update

- `docs/compatibility/taskplane-gap-list.md`
- `docs/compatibility/phase6-dogfood-report.md`
- `taskplane-tasks/CONTEXT.md`
- `taskplane-tasks/dependencies.json`

## Check If Affected

- `README.md` — slash-command stub table
- `docs/PRD.md` — only if adding Phase 6 completion note to §23 (optional)
- `src/batch/heartbeat.mjs` — only if implementing FR-WORK-10 file-scope mtime

## Git Commit Convention

- `feat(TP-029): complete Step N — description`

## Do NOT

- Implement `spine migrate-from-taskplane`, `--preset taskplane-compat`, or publish to npm (TP-030+)
- Hand-edit `.spine/batch-state.json` in tests without using engine APIs
- Run Taskplane `/orch` concurrently with pi-spine batch tests
- Weaken existing mixed-outcome merge policy to make tests pass
- Claim Phase 6 complete without dogfood report + incident test matrix

---

## Amendments (Added During Execution)
