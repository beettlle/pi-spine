# pi-spine

[![CI](https://github.com/beettlle/pi-spine/actions/workflows/ci.yml/badge.svg)](https://github.com/beettlle/pi-spine/actions/workflows/ci.yml)

**Orchestration spine for long-running pi development.**

pi-spine is a [pi](https://pi.dev) package that helps you run parallel, multi-day agent batches on real codebases. It combines the strongest ideas from [Taskplane](https://pi.dev/packages/taskplane), [Babysitter](https://github.com/a5c-ai/babysitter), and [pi-conductor](https://www.npmjs.com/package/@feniix/pi-conductor) without asking you to operate three separate orchestrators—or pick one and miss what the others do well.

---

## Why this exists

Long-running agent development fails for the same reasons repeatedly:

- **Context loss** when sessions compact or crash
- **Parallel collisions** when multiple agents edit one checkout
- **Opaque recovery** when a batch pauses and you cannot tell whether to resume, force-resume, or abort
- **Premature integration** when lane work merges without explicit approval or test evidence
- **Tool fragmentation** when each orchestrator owns state differently and none covers the full workflow

Taskplane, Babysitter, and pi-conductor each solve important slices of this problem. None of them, used alone, gives you **Taskplane-style task packets**, **Babysitter-grade audit history**, and **pi-conductor-style human gates** in one pi-native flow.

pi-spine exists to be that spine: a thin, composable layer you install once and run from your pi session.

---

## What pi-spine is (and is not)

| pi-spine is | pi-spine is not |
|-------------|-----------------|
| A pi extension + CLI (`spine`) for batch orchestration | A replacement for pi itself |
| Compatible with Taskplane `PROMPT.md` / `STATUS.md` packets | A fork of Taskplane |
| An append-only **orchestration journal** for control-plane events | A full Babysitter process-definition engine |
| **Human gates** before integrate/merge | A clone of pi-conductor's external control-plane DB |
| Worktree-isolated parallel lanes | Cross-harness routing (Cursor, Codex, etc.) in v1 |

Design philosophy: **compose, don't merge.** pi-spine adopts patterns; it does not reimplement three products as a fourth monolith.

---

## Advantages over using the others directly

### vs Taskplane alone

Taskplane is the best pi-native batch orchestrator today: dependency waves, worktree lanes, cross-model review, dashboard, and orch-branch integration. pi-spine builds on that foundation rather than competing with it.

| You get with pi-spine | Gap when using Taskplane only |
|-----------------------|-------------------------------|
| **Orchestration journal** — append-only timeline of batch, lane, task, gate, and integrate events | Batch state and diagnostics exist, but post-mortem replay across lane death is harder to reconstruct |
| **Explicit integrate gates** — merge blocked until you approve an evidence bundle (tests, diff stat, task scorecard) | Integration is powerful; human approval is less formalized |
| **Journal-driven reconciliation** — resume hints grounded in event history | Resume works, but stale or partial lane recovery can be opaque in long batches |
| **Same task packets** — point `--tasks-root` at existing `taskplane-tasks/` | No migration rewrite required |

**When to stay on Taskplane only:** You are happy with its dashboard, supervisor, and merge flow and do not need formal gates or a dedicated audit journal.

### vs Babysitter alone

Babysitter excels at **deterministic, event-sourced workflow orchestration** and cross-harness portability. Its pi plugin is experimental and thin; the heavy lifting lives in the SDK and harness adapters.

| You get with pi-spine | Gap when using Babysitter only |
|-----------------------|----------------------------------|
| **pi-native first-class UX** — slash commands, skills, worker sessions in pi | Pi integration is experimental; not the primary Babysitter surface |
| **File-based task packets** — `PROMPT.md` / `STATUS.md` as agent memory | Process definitions in JavaScript; different authoring model |
| **Git worktree lanes** tuned for coding batches | Not the core Babysitter story |
| **Lighter mental model** — journal at orchestration boundaries, not full process replay | Full replay engine is powerful but heavier for solo pi batch work |

**When to stay on Babysitter only:** You need one workflow engine across many harnesses (Codex, Cursor, Gemini) and want JS process definitions with full deterministic replay.

### vs pi-conductor alone

pi-conductor is an actively developed **agent-native control plane**: durable workers, gates, artifacts, and PR-oriented flows via model-callable tools.

| You get with pi-spine | Gap when using pi-conductor only |
|-----------------------|----------------------------------|
| **Taskplane-compatible packets** — reuse existing `TP-*` / `SP-*` folders | Objectives and tool-native orchestration; different task contract |
| **Wave + lane batch model** — familiar `/spine-plan all` → parallel worktrees | Scheduler and conductor tools; different UX paradigm |
| **Opinionated worker/reviewer pipeline** — step checkpoints, `.DONE`, inline review | More flexible control plane; you assemble more yourself |
| **In-repo task folders** as the handoff artifact for humans and agents | State largely outside the repo |

**When to stay on pi-conductor only:** You want tool-driven orchestration (`conductor_run_work`, gate dashboard, PR readiness) and prefer objectives over folder-based packets.

### The combined picture

```text
                    Audit / replay clarity
                           ▲
                           │
              Babysitter   │   pi-spine
                           │
         ──────────────────┼──────────────────► Batch orchestration
                           │
              pi-conductor │   Taskplane
                           │
                    Gates  │   Packets + dashboard
```

pi-spine targets the upper-right: **batch orchestration with strong audit trail and human gates**, using task packets you may already have.

---

## Feature summary

- **Taskplane-compatible tasks** — `PROMPT.md`, `STATUS.md`, `dependencies.json`
- **Dependency waves** — topological scheduling with parallel lanes
- **Git worktree isolation** — one lane per worktree; orch branch for integration
- **STATUS-first workers** — checkpoint discipline and step-boundary commits
- **Cross-model review** — reviewer model configurable separately from worker
- **Orchestration journal** — JSONL event log for debugging and resume context
- **Human gates** — approve or reject integrate with test/build evidence
- **Local dashboard** — batch, lane, and gate visibility (SSE)

See `docs/PRD.md` for the full specification.

---

## Prerequisites

| Dependency | Required |
|------------|----------|
| [Node.js](https://nodejs.org/) ≥ 22 | Yes |
| [pi](https://pi.dev) coding agent | Yes |
| Git (worktree support) | Yes |

---

## Quick start

```bash
# Install the pi package
pi install npm:pi-spine

# In your project repo
cd my-project
spine init --tasks-root taskplane-tasks --preset taskplane-compat
spine doctor
spine plan all
spine preflight
```

Run **`spine preflight`** before every batch (FR-BATCH-11). It verifies:

| Check | Requirement |
|-------|-------------|
| Doctor | `spine doctor` passes (Node, git, pi, config, agents, model provider) |
| Git clean | No uncommitted changes in the working tree |
| No active batch | No healthy active batch in `.spine/batch-state.json` (or Taskplane `.pi/batch-state.json`) |
| Tasks root | Configured tasks folder exists with discoverable `PROMPT.md` task folders |
| Dependencies | `{tasksRoot}/dependencies.json` parses and references valid task IDs |
| Wave plan | Dependency waves and lane assignment (same output as `spine plan all`) |

Use `spine preflight --json` for automation. Exit code is non-zero when any check fails.

### Batch status and reconciliation

Reconciled batch diagnosis (FR-BATCH-12–14) derives operator-facing state from task records, git, `.DONE` files, and batch-state — not from raw `phase` alone:

```bash
spine status                    # headline + suggested next command
spine status --diagnose         # verbose signal breakdown
spine status --json             # automation-friendly output
spine status --verbose          # include segment frontier (NFR-OBS-05)
```

Output includes `diagnosis`, `headline`, `suggestedCommand`, and optional `alternatives[]` per PRD §18.3. Diagnosis taxonomy (FR-BATCH-13): `running`, `paused`, `needs_retry`, `needs_merge`, `needs_integrate`, `completed`, `completed_manual`, `limbo_stale`, `failed`, `aborted`.

Reads `.spine/batch-state.json` first, then Taskplane `.pi/batch-state.json` during dogfood. When no batch exists, status reports a healthy idle state with `spine preflight` or `spine plan all` as the suggested next action.

### Batch dismiss, complete, and next action

Archive-first lifecycle for terminal limbo (FR-BATCH-15–16, §18.6):

```bash
spine batch dismiss --reason "manual recovery"     # limbo_stale, completed_manual, aborted
spine batch complete --detect-manual-merge         # after manual merge to main
spine batch complete --batch ID                    # orch on main + merge satisfied (FR-BATCH-16)
spine integrate [--dry-run]                        # merge orch branch → main (FR-INT-01)
spine next                                         # print suggestedCommand from reconciliation
spine next --execute                               # run suggested command (dismiss, preflight, etc.)
```

**Post-batch landing on `main`** (after `spine batch start` succeeds):

1. `spine status --diagnose` — expect `needs_integrate` when orch has commits not on `main`
2. `spine gate status` — review evidence under `.spine/runtime/{batchId}/evidence/`
3. `spine gate approve` — required when `gates.requireBeforeIntegrate` is true
4. `spine integrate` — local `--no-ff` merge of `orchBranch` → `baseBranch` (journal `integrate.started` / `integrate.completed`)
5. `spine batch complete` — archive batch record (refuses if orch is ahead of `main` but not merged; refuses **empty orch** when `mergeResults` claim success)
4. Push `main` to your remote when ready (pi-spine never auto-pushes)

`spine batch complete` validates orch integration using `countCommitsAhead` (same guard family as lane **EmptyMerge** at merge time). When `gates.requireBeforeIntegrate` is true, integrate is blocked until you approve the evidence bundle.

```bash
spine gate status                    # pending integrate gate + evidence paths
spine gate approve                   # required before integrate (exit 2 if skipped)
spine gate reject --reason "…"       # refuse merge; journals gate.rejected
spine integrate                      # merge after approval
spine integrate --force-integrate    # bypass only with SPINE_ALLOW_FORCE=1 (journaled)
```

Evidence is collected under `.spine/runtime/{batchId}/evidence/` (`summary.md` is an honest post-mortem per NFR-OBS-03, plus `diff-stat.txt` and optional test/build output from `spine-config.json` or `.pi/taskplane-config.json`). `spine batch dismiss` / `complete` also write `.spine/runtime/{batchId}/post-mortem.md` and record the path in `batch-history.json`.

In pi: `/spine-gate` and `/spine-integrate` delegate to `spine gate` and `spine integrate`.

**Limbo recovery playbook** (Taskplane batch red, all tasks green, empty `mergeResults`):

1. `spine status --diagnose` — expect `limbo_stale` or `completed_manual`
2. If work is already on `main`: `spine batch complete --detect-manual-merge`
3. If batch should be cleared without claiming merge: `spine batch dismiss --reason …`
4. Do not hand-edit `.pi/batch-state.json`; pi-spine archives to `.spine/runtime/{batchId}/archive/` first

In pi: `/spine-dismiss`, `/spine-next`, and `/spine` route to the same reconciliation (never suggest pause for terminal limbo).

### Wave planning

Preview dependency waves and parallel lanes before starting a batch (FR-SCHED-01–06):

```bash
spine plan all                              # all discovered tasks (full backlog)
spine plan pending                          # tasks without `.DONE` marker
spine plan TP-008                           # explicit task ID(s)
spine plan 'taskplane-tasks/TP-008-*'       # glob on task folder paths
spine plan pending --json                   # JSON plan; scope.mode pending + excluded count
```

Each `spine plan` run writes a plan artifact to `.spine/runtime/plan-{timestamp}.json`.

### Running a batch (Phase 2–5)

pi-spine runs batches without Taskplane `/orch`. **Single-task** batches always work. **Multi-task** batches are allowed when the plan has one wave with multiple virtual lanes (disjoint file scopes), when scope is explicit (task IDs), or when scope is **`pending`** (unfinished tasks only). **`spine batch start all`** resolves to the same pending-filtered set as `pending` (unlike `spine plan all`, which previews the full backlog):

```bash
spine preflight                              # required (FR-BATCH-11)
spine batch start TP-012                     # one task
spine batch start TP-997 TP-998              # explicit multi-task (one wave, parallel lanes)
spine batch start pending                    # all tasks without `.DONE`, dependency order
spine batch start all                        # same as pending (not full backlog)
spine run pending                            # alias for batch start (PRD §15.2 automation)
spine run pending --dry-run --skip-preflight # flag passthrough
spine batch start TP-012 --dry-run           # preflight + plan only
spine batch start TP-012 --json              # machine-readable result
```

If every discovered task has a `.DONE` marker, `pending` / `all` batch start fails fast: `No pending tasks (all discovered tasks have .DONE).` Tasks that already have `.DONE` on disk are skipped before the worker runs (journal event `task.skipped_done_on_disk`). Wave integrate / `batch complete` between waves is still manual — pi-spine does not auto-integrate mid-batch.

**What happens:** preflight → planner waves + lane ticks (`lanes.maxParallel`, FR-SCHED-03/04) → `.spine/batch-state.json` (schema v1, includes `segments[]`) → one git worktree per physical lane (`.worktrees/spine-{batchId}/lane-N`, branch `task/spine-lane-N-{batchId}`) → workers run in parallel per tick → `.DONE` → **lane auto-commit** → after each wave, **sequential merges** into `orch/spine-{batchId}` (FR-BATCH-08) only when every wave task is `succeeded` or `skipped` (§17.4 mixed-outcome policy; GAP-MERGE-01).

**Mixed outcomes:** if any task in a wave is `failed` or still `pending`, merge is blocked, phase becomes `failed`, and messaging names failed IDs with `/spine-retry-task` / `/spine-skip-task` hints (never “batch ran smoothly”). Operator override: `spine batch force-merge --wave 0` then `spine batch resume --force`.

Workers should still **commit at step boundaries** (see `.spine/agents/worker.md`); auto-commit is a safety net for pi sessions that finish with `.DONE` but forgot to commit.

### Step review (FR-REV, TP-020)

When a task `PROMPT.md` has **Review Level > 0**, workers call the reviewer after step boundaries:

```bash
spine review step --step 1 --type plan     # level >= 1
spine review step --step 1 --type code     # level >= 2 (optional --baseline <sha>)
```

- Verdicts: structured JSON `{ "verdict": "APPROVE"|"REVISE", "feedback": "..." }` (also written in the review artifact)
- Artifacts: `{taskFolder}/.reviews/{step}-{timestamp}.md`
- Journal: `review.started`, `review.completed`, `review.failed`
- **Fail closed (FR-REV-06):** if review spawn fails at level > 0, the worker stops (non-zero exit) — no silent skip

Reviewer model is configured separately in `.spine/spine-config.json` (`agents.reviewer`).


### Pause and resume (Phase 3 — single lane)

```bash
spine batch pause                    # stop scheduling; journal batch.paused
spine batch resume                   # continue paused batch (§18.2 resume semantics)
spine batch resume --force           # resume failed batch after stale lane state
spine batch pause --json
```

Resume skips tasks already marked complete via `.DONE` or journal `task.completed`, respawns the worker in the existing lane worktree for pending segments, logs `batch.resumed` with `{ resumeForced, pendingSegments }`, then runs lane commit + merge.

In pi: `/spine-pause` and `/spine-resume` delegate to `spine batch pause|resume`. When `spine status` reports `diagnosis: paused`, the suggested command is `spine batch resume` (not Taskplane pause).

### Abort (Phase 3 — archive-first, §18.6)

Stop a batch without losing recoverable state (closes GAP-ABORT-01):

```bash
spine batch abort                         # graceful: abort signal; worker may finish step boundary
spine batch abort --hard                  # SIGKILL lane workers; remove worktrees (configurable)
spine batch abort --reason "stall kill"   # journal reason on batch.aborted
spine batch abort --hard --json
```

**Archive-first:** pi-spine always writes `.spine/runtime/{batchId}/archive/batch-state.json` (including `segments[]`) **before** clearing `.spine/batch-state.json` or Taskplane `.pi/batch-state.json`. The journal append-only log is preserved; `batch.aborted` is appended with reason and prior tail metadata.

Graceful abort writes `.spine/runtime/{batchId}/abort-signal.json` (`hard: false`). The worker host polls this signal and sends SIGTERM so the worker can exit at the next poll boundary. Hard abort sets `hard: true`, kills `lane.workerPid` when recorded, and removes lane worktrees unless `lanes.cleanupWorktreesOnHardAbort` is `false` in `.spine/spine-config.json`.

In pi: `/spine-abort` and `/spine-abort --hard` delegate to `spine batch abort`. When a batch was aborted, `spine status` reports `diagnosis: aborted` — use `spine batch dismiss` to clear limbo if needed.

### Retry and skip (Phase 3)

When a task fails or segment state drifts (Taskplane GAP-RETRY-01), reset task + segments atomically before resume:

```bash
spine batch retry TP-012              # reset task + segments; journal pendingSegments
spine batch skip TP-012               # skip failed task; unblock wave merge (FR-BATCH-10)
spine batch force-merge --wave 0      # operator override for §17.4 (then resume --force)
spine batch retry TP-012 --json
```

Retry clears task timestamps, resets all segment records for the task to `pending`, decrements `failedTasks`, and journals `task.retry_requested` with `{ taskId, previousClassification, pendingSegments }`. Resume refuses segment drift (`RetrySegmentDrift`) until retry or `--force`.

In pi: `/spine-retry-task <taskId>` and `/spine-skip-task <taskId>` delegate to `spine batch retry|skip`. When `spine status` reports `diagnosis: needs_retry`, the suggested command is `/spine-retry-task {id}`.

**Runtime layout:**

| Path | Purpose |
|------|---------|
| `.spine/batch-state.json` | Active batch (pi-spine native; not `.pi/batch-state.json`) |
| `.spine/batch-history.json` | Terminal batch summaries (complete/dismiss/aborted) |
| `.spine/runtime/{batchId}/archive/batch-state.json` | Archived batch snapshot after abort/dismiss/complete |
| `.spine/runtime/{batchId}/abort-signal.json` | In-flight abort request (graceful or hard) |
| `.spine/runtime/{batchId}/journal/events.jsonl` | Append-only journal |
| `.worktrees/spine-{batchId}/lane-N` | Lane worktree (N = 1 … `lanes.maxParallel`) |

**Recovery:** `spine status --diagnose` → `spine batch dismiss` or `spine batch complete` (same as Phase 1b lifecycle).

### Journal replay and state validation (TP-014)

Audit orchestration timelines and validate batch-state cache integrity:

```bash
spine journal replay --batch 20260601T120000     # human table: time | type | lane | task | summary
spine journal replay --batch 20260601T120000 --json
spine state validate                             # active .spine/batch-state.json
spine state validate --batch 20260601T120000     # archived runtime copy
spine state validate --diagnose                  # extra context on validation failure
```

Journal events use **schema v1** (`schemaVersion`, `eventId`, ISO `timestamp`, optional `correlationId`, `payload`). Legacy JSONL lines without `schemaVersion` remain readable.

On **complete** or **dismiss**, pi-spine appends a summary entry to `.spine/batch-history.json` and writes terminal journal events (`batch.completed` / `batch.dismissed`).

**CI / tests without `pi`:** set `SPINE_WORKER_STUB=1` so the worker runner touches `.DONE` instead of spawning `pi` (see `bin/spine-worker-runner.mjs`). Use `SPINE_WORKER_STUB_FAIL_TASKS=TP-998` (comma-separated) to simulate task failure for mixed-outcome tests.

**Heartbeat and stall (TP-013):** during a batch, the engine polls lane progress (STATUS.md mtime, lane-branch commits) and appends `lane.heartbeat` to the journal on an interval (default 10 minutes). Stall kill uses §18.4 grace after progress. Configure in `.spine/spine-config.json`:

```json
"lanes": {
  "stallTimeoutMinutes": 60,
  "stallGraceAfterProgressMinutes": 15,
  "heartbeatIntervalMinutes": 10
}
```

With `pi` on PATH, `spine batch start` runs `pi -p` against the task `PROMPT.md` (disable via `SPINE_WORKER_PI_AGENT=0`).

Do **not** run `spine batch start` and Taskplane `/orch` on the same repo concurrently.

In a pi session (`/spine` runs preflight before batch guidance; `/spine-plan` invokes the planner):

| Command | Status |
|---------|--------|
| `/spine` | Preflight + `spine batch start` for a **single** task ID (Phase 2) |
| `/spine-plan` | Preview waves and lanes (usage: `/spine-plan <all\|paths>`) |
| `/spine-status` | Reconciled batch diagnosis + lane health (FR-BATCH-14) |
| `/spine-dismiss` | `spine batch dismiss` (limbo / completed_manual) |
| `/spine-next` | `spine next` — suggested next command |
| `/spine-pause` | `spine batch pause` — stop scheduling |
| `/spine-resume` | `spine batch resume` — continue paused or failed batch |
| `/spine-abort` | `spine batch abort` — archive-first abort (`--hard` kills workers) |
| `/spine-gate` | Stub — gate inspection and resolution |
| `/spine-integrate` | Merge orch branch → `main` (`spine integrate`; gate stub in Phase 3) |
| `/spine-settings` | Stub — interactive configuration |
| `/spine-deps` | Stub — dependency graph |

Most slash commands remain stubs; **`/spine`**, **`/spine-plan`**, **`/spine-status`**, **`/spine-dismiss`**, and **`/spine-next`** are implemented. **`/spine <task-id>`** starts a Phase 2 single-task batch when preflight passes (stub worker unless `SPINE_WORKER_STUB=0` and `pi` is on PATH). Stubs reply with a notification pointing to `spine help` and a future phase. **`/spine`** runs `spine preflight` first and blocks batch guidance when preflight fails. Example flow:

```text
spine preflight   # required before batch (FR-BATCH-11)
/spine-plan all    # preview waves and lanes
/spine all         # run the batch
/spine-status      # monitor progress
/spine-gate        # review evidence before merge
/spine-integrate   # merge orch branch (after gate approval)
```

Optional: run the dashboard in another terminal:

```bash
spine dashboard    # default http://localhost:8109
```

---

## Migrating from Taskplane

If you already use Taskplane task folders:

1. Install pi-spine in the same or a new repo.
2. `spine init --tasks-root taskplane-tasks --preset taskplane-compat`
3. Migrate config from `.pi/taskplane-config.json` (see `spine migrate-from-taskplane`).
4. Run `/spine-plan all` and compare to your last Taskplane plan.

Do **not** run Taskplane and pi-spine batches on the same repo at the same time.

---

## Project status

**Early development.** pi-spine is designed as a personal orchestration spine first, publishable as `npm:pi-spine` when stable. API and behavior may change before v1.0.

## Continuous integration

Every push and pull request to `main` runs [GitHub Actions CI](.github/workflows/ci.yml): `npm ci`, `npm run typecheck`, `npm test` (when defined), and CLI smoke checks (`spine version`, `help`, `doctor`).

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/PRD.md](docs/PRD.md) | Product requirements and implementation contract |
| pi.dev package page | Install and package manifest (when published) |

---

## License

MIT (intended).

---

## Related projects

- [Taskplane](https://pi.dev/packages/taskplane) — parallel task orchestration for pi
- [Babysitter](https://github.com/a5c-ai/babysitter) — event-sourced workflow SDK
- [pi-conductor](https://www.npmjs.com/package/@feniix/pi-conductor) — durable agent control plane for pi
- [pi-subagents](https://www.npmjs.com/package/pi-subagents) — optional delegation layer (planned v1.1 backend)

pi-spine respects these tools: it composes their best patterns rather than replacing them outright.
