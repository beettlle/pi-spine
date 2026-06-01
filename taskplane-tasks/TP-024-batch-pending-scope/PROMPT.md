# Task: TP-024 — Pending scope + relaxed batch `all` (Phase 5)

**Created:** 2026-06-01
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Changes batch-start policy and scope resolution — operator-facing, must not re-run completed tasks or bypass mixed-outcome guards.
**Score:** 4/8

## Mission

Enable **"run everything left in plan order"** without hand-listing task IDs:

1. **`pending` scope** — extend FR-SCHED-06 so `spine plan pending` and `spine batch start pending` include only tasks **without** a task-folder `.DONE` marker (same terminal signal reconciliation uses).
2. **Relaxed multi-wave batch start** — allow multi-wave batches when scope is `pending` (treat like explicit scope in `canStartMultiTaskBatch()`).
3. **Relaxed `all` for batch start** — `spine batch start all` resolves to the **pending-filtered** task set (not every discovered task). `spine plan all` stays unchanged (full backlog preview).
4. **`spine run pending`** — alias to `spine batch start pending` (PRD §15.2 automation entry point; `--dry-run`, `--json`, `--skip-preflight` passthrough).
5. **Fast-path skip** — before `runWorker`, if `.DONE` exists mark task `skipped` / `succeeded` with journal `task.skipped_done_on_disk` (do not spawn worker or fail merge).
6. **Empty pending** — fail fast: `No pending tasks (all discovered tasks have .DONE).`

**Out of scope:** auto `integrate` / `batch complete` between waves; dashboard (TP-023); changing Taskplane `/orch` behavior.

**Success:** `spine batch start pending --dry-run` plans only unfinished tasks in dependency order; `spine batch start all --dry-run` matches pending; **130+** tests; wave 15.

## Dependencies

- **TP-022** — Phase 4 complete on `main` (honest post-mortem + integrate gate shipped)

## Context to Read First

- `src/batch/engine.mjs` — `canStartMultiTaskBatch()`, `isExplicitBatchScope()`, wave loop
- `src/planner/scope.mjs`, `src/planner/index.mjs` — scope parsing + `buildPlan()`
- `src/batch/reconcile.mjs` — `.DONE` / `doneFileFound` classification
- `src/compat/taskplane/discover.mjs`
- `README.md` — "Running a batch (Phase 2–3)" section
- `docs/PRD.md` — §7.3 FR-SCHED-06, §15.2 `spine run <scope>`

## File Scope

- `src/planner/pending.mjs` (new) — `filterPendingTaskIds(discoveredTasks, tasksRoot)`
- `src/planner/scope.mjs`, `src/planner/index.mjs`
- `src/batch/engine.mjs` — scope normalization, skip-on-done, batch policy
- `bin/spine-batch.mjs`, `bin/spine-plan.mjs`, `bin/spine.mjs` — `spine run` subcommand
- `extensions/spine/slash-commands.ts` — optional `/spine-run` stub or help text only
- `tests/planner/pending-scope.test.mjs` (new)
- `tests/batch/engine.test.mjs` (extend)
- `README.md`, `taskplane-tasks/CONTEXT.md`, `docs/compatibility/taskplane-gap-list.md`

## Steps

### Step 0: Preflight
- [ ] Read engine wave loop + current `canStartMultiTaskBatch` guard
- [ ] Confirm baseline: `spine batch start all --dry-run` fails today; `spine batch start TP-020 TP-021 --dry-run` succeeds

### Step 1: Pending scope filter + plan CLI
> **Plan-review checkpoint** — define pending vs terminal semantics
- [ ] Add `filterPendingTaskIds()` — exclude tasks whose folder contains `.DONE`
- [ ] Extend `parseScope()` — modes: `pending` (new), existing `all` / `ids` / `glob`
- [ ] `buildPlan({ scope: 'pending' })` — only pending IDs, dependency waves unchanged
- [ ] `spine plan pending` human + JSON output shows `scope.mode: pending` and excluded count
- [ ] Tests: fixture tasks with/without `.DONE`; empty pending error

### Step 2: Batch policy + execution skip
- [ ] `isExplicitBatchScope()` — true for `pending`
- [ ] Batch start scope normalization: bare `all` → pending-filtered IDs before `buildPlan()` (plan CLI unaffected)
- [ ] `spine batch start pending` and `spine batch start all --dry-run` succeed for multi-wave pending backlog
- [ ] Pre-worker skip when `.DONE` on disk; journal `task.skipped_done_on_disk`
- [ ] Tests: multi-wave dry-run; skip path does not call worker stub

### Step 3: `spine run` alias + docs
- [ ] `spine run pending` → `spine batch start pending` (same flags)
- [ ] README — document `pending`, relaxed batch `all`, land loop still manual
- [ ] CONTEXT — Phase 5 row for TP-024; gap list row **GAP-BATCH-PENDING-01** closed
- [ ] Full verification: `npm run typecheck && npm test` (**130+**)

## Completion Criteria

- [ ] `spine plan pending` lists only tasks without `.DONE`
- [ ] `spine batch start pending` / `spine batch start all` run multi-wave pending backlog (dry-run + unit tests)
- [ ] Done tasks never spawn workers when included accidentally
- [ ] Tests pass (**130+**)

## Must Update

- `README.md`
- `taskplane-tasks/CONTEXT.md`
- `docs/compatibility/taskplane-gap-list.md`

## Check If Affected

- `docs/PRD.md` — add FR-BATCH-20 pending scope if documenting formally
- `bin/spine.mjs` help text

## Git Commit Convention

- `feat(TP-024): complete Step N — description`

## Do NOT

- Auto integrate / complete between waves
- Re-run tasks with `.DONE` unless operator removes marker
- Break explicit-ID batch start (`spine batch start TP-020 TP-021`)
- Weaken mixed-outcome merge guard (§17.4)

---

## Amendments (Added During Execution)
