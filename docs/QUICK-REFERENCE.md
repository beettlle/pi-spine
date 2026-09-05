# pi-spine Quick Reference

This guide provides quick command references for common operations.

---

## 📋 Command Categories

| Category | Commands |
|----------|----------|
| **Setup** | `init`, `doctor`, `migrate-from-taskplane` |
| **Planning** | `preflight`, `plan`, `deps`, `settings` |
| **Batch Control** | `batch start`, `batch pause`, `batch resume`, `batch abort`, `batch retry`, `batch skip` |
| **Review** | `review step`, `gate`, `integrate` |
| **Status** | `status`, `journal`, `state`, `next` |
| **Utility** | `handoff`, `metrics`, `report`, `dashboard`, `tasks` |

---

## 🔧 Setup Commands

### Initialize Project

```bash
# Create .spine/ config and agent stubs
spine init

# With custom tasks root
spine init --tasks-root taskplane-tasks

# Preview changes without writing
spine init --dry-run

# Overwrite existing config
spine init --force
```

### Validate Installation

```bash
# Run all health checks
spine doctor

# Check specific component
spine doctor --component pi
spine doctor --component git
spine doctor --component config
```

### Migration

```bash
# Migrate Taskplane config
spine migrate-from-taskplane

# Preview migration
spine migrate-from-taskplane --dry-run

# Specify source config
spine migrate-from-taskplane --source .pi/taskplane-config.json
```

---

## 📊 Planning Commands

### Preflight Checks

Run **before every batch**. Exit code is non-zero when any check fails.

```bash
# Run preflight validation (required before batch start)
spine preflight

# JSON output for automation
spine preflight --json
```

| Check | Requirement |
|-------|-------------|
| Doctor | `spine doctor` passes (Node, git, pi, config, agents) |
| Git clean | No uncommitted changes in the working tree |
| No active batch | No healthy active batch in `.spine/batch-state.json` (or Taskplane `.pi/batch-state.json`) |
| Tasks root | Configured tasks folder exists with discoverable `PROMPT.md` task folders |
| Dependencies | `{tasksRoot}/dependencies.json` parses and references valid task IDs |
| Tasks validate | Pending `PROMPT.md` packets pass structural validation (v1.3+) |
| Wave plan | Dependency waves and lane assignment (same output as `spine plan`) |

`spine doctor` also prints an advisory **lanes.maxParallel** sizing line when config is valid (configured vs CPU-based suggestion). The hint never fails doctor; it may warn when configured parallelism looks high for your machine. For expected node process count (pi vs spine vs harness), poll defaults, and CPU mitigations, see [operator-runbook §3 — Orchestrator process model](./adoption/operator-runbook.md#orchestrator-process-model-98).

### Plan Visualization

```bash
# Preview all tasks
spine plan all

# Preview pending tasks only
spine plan pending

# Preview specific tasks
spine plan TP-012
spine plan TP-012 TP-013

# Preview with glob
spine plan 'taskplane-tasks/TP-008-*'

# JSON output
spine plan all --json
```

### Dependencies

```bash
# Show dependency graph
spine deps all

# Show for specific task
spine deps TP-012

# JSON output
spine deps TP-012 --json
```

### Configuration

```bash
# Show all editable fields
spine settings show

# Show single value
spine settings show lanes.maxParallel
spine settings show lanes.maxParallel --json

# Set value (validated)
spine settings set lanes.maxParallel 2

# Preview without writing
spine settings set dashboard.port 8110 --dry-run
```

---

## 🚀 Batch Control Commands

### Start a Batch

```bash
# Start single task
spine batch start TP-012

# Start multiple tasks
spine batch start TP-012 TP-013

# Start all pending tasks
spine batch start pending

# Start all tasks (same as pending)
spine batch start all

# Run detached (background, default)
spine batch start TP-012

# Run attached (foreground)
spine batch start TP-012 --attached

# Dry run (no execution)
spine batch start TP-012 --dry-run

# JSON output
spine batch start TP-012 --json
```

### Monitor Progress

For a decision table mapping operator questions to `watch`, `journal follow`, `wait`, dashboard, and engine logs, see [operator-runbook.md §3 Monitoring cookbook](./adoption/operator-runbook.md#monitoring-cookbook).

```bash
# Status with diagnosis
spine status

# Verbose diagnosis
spine status --diagnose

# JSON output
spine status --json

# Include segment frontier
spine status --verbose

# Live reconcile poll (default 5s)
spine watch
spine watch --json --once
spine watch --interval 10   # lighter orchestrator poll (see runbook §3)

# Block until terminal diagnosis (CI)
spine wait --until completed,failed --json --timeout 30m

# Live journal events
spine journal follow [--lane lane-1]
```

### Pause and Resume

```bash
# Pause current batch
spine batch pause

# Resume paused batch (default: detached)
spine batch resume

# Resume attached (foreground)
spine batch resume --attached

# Force resume (bypass validation)
spine batch resume --force
```

### Abort Batch

```bash
# Graceful abort (SIGTERM)
spine batch abort

# Hard abort (SIGKILL, remove worktrees)
spine batch abort --hard

# Include reason
spine batch abort --reason "stall kill"
```

### Retry and Skip

```bash
# Retry a failed task
spine batch retry TP-012

# Force retry (override validation)
spine batch retry TP-012 --force

# Skip a failed task
spine batch skip TP-012

# Force merge wave (operator override)
spine batch force-merge --wave 0
```

---

## 📝 Review Commands

### Step Review

```bash
# Request code review for step 1
spine review step --step 1 --type code

# Request final review for step 1
spine review step --step 1 --type final

# Request plan review for step 1
spine review step --step 1 --type plan
```

### Gate Management

```bash
# Inspect integrate gate status
spine gate status

# Approve gate (if required) — optional --synthesis readback note (#280)
spine gate approve
spine gate approve --synthesis "tests green, scope matches PROMPT"

# Reject gate
spine gate reject --reason "test failures"

# Bypass gate (with override)
SPINE_ALLOW_FORCE=1 spine integrate --force-integrate
```

### Integration

```bash
# Merge orch branch to main
spine integrate

# Dry run
spine integrate --dry-run

# Bypass gate check (force integrate)
SPINE_ALLOW_FORCE=1 spine integrate --force-integrate
```

---

## 📈 Status and Utility Commands

### Status and Diagnosis

Reconciled diagnosis derives state from task records, git, `.DONE` files, and batch-state — not from raw `phase` alone. Output includes `diagnosis`, `headline`, `suggestedCommand`, and optional `alternatives[]`.

```bash
# Reconciled batch diagnosis
spine status

# Verbose diagnosis
spine status --diagnose

# JSON output
spine status --json

# Include segment frontier
spine status --verbose

# Next suggested command (dry-run)
spine next

# Execute next command
spine next --execute
```

**Diagnosis taxonomy:**

| `diagnosis` | Meaning |
|-------------|---------|
| `running` | Workers active |
| `paused` | Batch suspended |
| `needs_retry` | Failed or dead worker task |
| `engine_orphaned` | Batch engine died mid-run |
| `worker_orphaned` | Worker running but engine died |
| `needs_merge` | Wave done, lane merge blocked |
| `needs_integrate` | Orch ahead of `main` — land loop |
| `needs_replan` | Final review REPLAN — edit PROMPT |
| `completed` | Batch terminal, merged |
| `completed_manual` | Work on `main`, batch record stale |
| `limbo_stale` | Tasks green, batch record stale |
| `failed` | Terminal error |
| `aborted` | Batch manually aborted |
| `state_drift` | Journal rebuild disagrees with cache |

When no batch exists, status reports idle with `spine preflight` or `spine plan all` as the suggested next action.

### Journal Replay

```bash
# Replay events for a batch
spine journal replay --batch 20260612T143000

# JSON output
spine journal replay --batch 20260612T143000 --json
```

### State Validation

```bash
# Validate active batch state
spine state validate

# Validate archived batch state
spine state validate --batch 20260612T143000

# With extra context
spine state validate --diagnose
```

### Batch Completion

```bash
# Complete batch (archive and clear)
spine batch complete

# Detect manual merge
spine batch complete --detect-manual-merge

# Dismiss stale batch
spine batch dismiss --reason "manual recovery"

# Complete with specific batch ID
spine batch complete --batch 20260612T143000
```

---

## 🔍 Task Commands

### Validate Tasks

```bash
# Validate pending tasks
spine tasks validate pending

# Validate all tasks
spine tasks validate all

# JSON output
spine tasks validate all --json
```

### Analyze Tasks

```bash
# Structural checks on pending tasks (blocking vs warnings)
spine tasks analyze pending

# Analyze all tasks
spine tasks analyze all

# JSON output (AnalyzeTasksResult)
spine tasks analyze pending --json
```

Exit codes: `0` when no blocking findings (warnings alone exit 0); `1` when blocking issues exist.

### Task Types

#### Matrix tasks (`## Matrix`)

Parametric tasks fan out one row per matrix table row into parallel sub-lanes. Use `{matrix.<column>}` placeholders in the contract and steps.

```markdown
## Matrix

| run_id | target_region |
|--------|---------------|
| us_east | us-east-1 |
| eu_west | eu-west-1 |

## Contract

| Field | Value |
|-------|-------|
| testCommand | `scripts/deploy-{matrix.target_region}.sh` |
| fileScopeMustChange | `spine-tasks/{taskId}/STATUS.md` |
```

`spine plan` lists the matrix task as a single parent task; the engine fans rows out into parallel sub-lanes at run time as first-class occupants of the global `lanes.maxParallel` pool (SP-697 / #228, superseding the SP-690 nested-slot throttle). The parent task succeeds only if **all rows** succeed; any failing row fails the parent and surfaces the failing row id. See [operator-runbook.md §2.4 Matrix tasks](./adoption/operator-runbook.md#24-matrix-tasks-parametric-sub-lanes) for full syntax and caveats.

#### Execution-only tasks (`Type: execute`)

Bypass the LLM worker and run a shell command directly in the lane worktree.

```markdown
# Task: SP-101 — Regenerate API client stubs
**Type:** execute

## Contract

| Field | Value |
|-------|-------|
| runCommand | `npm run generate-api-client` |
| testCommand | `npm run typecheck` |
| fileScopeMustChange | `src/api-client/**` |
```

Exit 0 touches `.DONE`; non-zero fails the task. Lane isolation, `maxParallel`, and contract verification still apply. See [operator-runbook.md §2.5 Execution-only tasks](./adoption/operator-runbook.md#25-execution-only-tasks-type-execute).

---

## 📊 Metrics and Reporting

### Run Metrics

```bash
# Show all metrics
spine metrics show

# Show for specific batch
spine metrics show --batch 20260612T143000

# Show last N runs
spine metrics show --last 5

# JSON output
spine metrics show --json
```

When usage fields (`tokensIn`, `tokensOut`, `estimatedUsd`) are present in `.spine/run-metrics.jsonl`, the output appends three rollup tables:

- **Usage by batch**
- **Usage by model**
- **Usage by role**

Records with missing usage are omitted from rollups so totals stay clean. Cost and token columns are shown only when the underlying records carry them; nothing is invented.

### Quota Snapshots

```bash
# Write timestamped JSON report and print a short human summary
spine metrics quota

# Emit snapshot JSON to stdout (automation / CI)
spine metrics quota --json

# Also write a self-contained HTML report beside the JSON file
spine metrics quota --open
```

Report paths:

- JSON: `.spine/reports/quota-snapshot-<ISO-timestamp>.json`
- HTML: `.spine/reports/quota-snapshot-<ISO-timestamp>.html` (only with `--open`)

The snapshot joins the active agent model configuration from `.spine/spine-config.json` with observed task usage from `.spine/run-metrics.jsonl`. Each pool shows one of the following source values:

| Source | Meaning |
|--------|---------|
| `estimate` | Observed task usage was aggregated for that provider pool. |
| `absent` | No tasks were recorded for that pool in the metrics file. |
| `live` | A provider probe succeeded and enriched the pool with live usage. Probes read credentials from `~/.pi/agent/auth.json` and fail closed to `estimate`/`absent` when credentials are missing or the request fails. |

Remaining headroom, burn rate, and ETA are reported as **unknown** when provider limits are not configured. No fake cost, invented remaining quota, or guessed percentage is emitted. API keys and prompt bodies are never written into the report.

#### Probe credential classes

Optional probes read credentials from `~/.pi/agent/auth.json`. Each pool requires a specific credential class; anything less degrades to `absent` without ever sending the weaker credential over the wire.

| Pool | Credential class | Auth entry | Endpoint used |
|------|------------------|------------|---------------|
| `zai` | Inference API key | `{ "zai": { "key": "..." } }` | Z.ai quota monitor |
| `kimi-coding` | Inference API key | `{ "kimi-coding": { "key": "..." } }` | Moonshot balance |
| `cursor` | Admin key only | `{ "cursor": { "type": "admin_key", "key": "..." } }` or an `adminKey` field | Cursor teams daily usage |
| `anthropic` | Anthropic **Admin** key only (`sk-ant-admin...`); regular inference keys (`sk-ant-api...`) are never used | `{ "anthropic": { "type": "admin_key", "key": "..." } }` or an `adminKey` field | Anthropic Admin usage report |
| `github-copilot` | GitHub PAT **plus** explicit org or enterprise context (billing/enterprise scope); user-level entries are not probed | `{ "github-copilot": { "key": "ghp_...", "org": "my-org" } }` or `"enterprise": "my-ent"` | GitHub Copilot billing (org/enterprise) |

#### Probe degrade matrix

All probes fail closed. No probe invents a remaining percentage or limit, and no probe output contains secrets.

| Condition | Result |
|-----------|--------|
| Auth file missing, unreadable, or malformed | `source: "absent"` for every pool |
| Credential present but wrong class (e.g. Cursor regular key, Anthropic inference key, Copilot PAT without org/enterprise) | `source: "absent"`; endpoint is never called |
| Network error, timeout, or DNS failure | `source: "absent"` with the error attached |
| Non-OK HTTP response (401/403/404/5xx) | `source: "absent"` |
| OK response without explicit usage/limit fields | `source: "live"`; usage stays zeroed and no `limit` is attached |
| OK response with explicit usage/limit fields | `source: "live"` with exactly those numbers |

### Progress Reporting

```bash
# Report step progress
spine report progress --step 1
```

### Handoff

```bash
# Write handoff note
spine handoff

# For specific batch
spine handoff --batch 20260612T143000

# JSON output
spine handoff --json
```

---

## 📊 Dashboard

```bash
# Start dashboard (default port 8109)
spine dashboard

# Custom port
spine dashboard --port 8110

# One-shot snapshot
spine dashboard --json
```

Default port **8109** (avoids Taskplane 8099). Configure in `.spine/spine-config.json` → `dashboard.port`. The UI streams reconciled snapshots over SSE (`/api/events`). Panels: diagnosis banner (badge from `diagnosis`, not raw `phase`), copyable CLI action chips, wave progress, lane table (**Active tasks** vs **Batch assignment**), integrate gate, journal tail. Read-only — run commands from your terminal. See [operator-runbook.md](./adoption/operator-runbook.md) §7.

---

## 🧪 Dev scripts

### Best-of-N (`scripts/best-of-n.mjs`)

Runs the **same prompt** through **multiple pi models in parallel**, each in its own git worktree. Use to compare model outputs on a one-off task — **not** for production batch orchestration.

| Best-of-N | `spine batch start` |
|-----------|---------------------|
| One prompt, N models side-by-side | Task packets, dependency waves, lane scheduling |
| Manual compare diffs in `.worktrees/bon-<runId>/` | Lane merge → orch branch, journal, integrate gates |
| No batch state, `.DONE`, or review pipeline | Step checkpoints, cross-model review, auto-commit on `.DONE` |

**Availability:** Git checkout only — **not** shipped in the npm package `files` whitelist. Use a git clone or path install.

**Prerequisites:** Node.js ≥ 22, [pi](https://pi.dev), git worktree support. Models resolve via `pi --list-models` (same catalog as `/model` in pi).

```bash
# List models (optional search filter)
node scripts/best-of-n.mjs --list-models [search]

# Comma-separated models + prompt
node scripts/best-of-n.mjs sonnet,composer-2.5,codex-5.3 "Fix the flaky logout test"

# Repeatable -m flag; @file prompts supported
node scripts/best-of-n.mjs -m sonnet -m composer-2.5 @spine-tasks/SP-001/PROMPT.md

# Provision worktrees and print pi argv without running
node scripts/best-of-n.mjs --dry-run sonnet,codex-5.3 @task/PROMPT.md
```

**Worktrees:** `.worktrees/bon-<runId>/<model-slug>/` on branch `bon/<runId>/<slug>`. When `.cursor/worktrees.json` exists, setup runs with `ROOT_WORKTREE_PATH` set to the project root.

**Options:** `--base-branch <ref>` (default: current `HEAD`), `--thinking <level>` (passed to pi), `--keep` (default — retain worktrees), `--cleanup` (remove worktrees after runs finish), `--cleanup-run <runId>` (remove a previous run).

**After a run (default `--keep`):** Compare with `git -C .worktrees/bon-<runId>/<model-slug> diff HEAD`. Remove when done:

```bash
node scripts/best-of-n.mjs --cleanup-run <runId>
```

---

## 🎯 Common Workflows

### Start a New Batch

```bash
# 1. Validate environment
spine doctor

# 2. Check preflight
spine preflight

# 3. Plan the batch
spine plan all

# 4. Start the batch
spine batch start pending

# 5. Monitor status
spine status --diagnose
```

### Resume a Paused Batch

```bash
# 1. Check status
spine status

# 2. Resume
spine batch resume

# 3. Monitor
spine status --diagnose
```

### Handle a Failed Task

```bash
# 1. Diagnose the failure
spine status --diagnose

# 2. Get suggested recovery
spine next

# 3. Retry the task
spine batch retry TP-012

# 4. Or skip it
spine batch skip TP-012
```

### Complete a Batch

```bash
# 1. Check status
spine status

# 2. Inspect gate (if required)
spine gate status

# 3. Approve gate (if required)
spine gate approve

# 4. Integrate
spine integrate

# 5. Complete
spine batch complete
```

---

## 🔁 Shortcuts

| Full Command | Shortcut |
|--------------|----------|
| `spine batch start` | `spine run` |
| `spine batch resume` | (none) |
| `spine status --diagnose` | `spine status` |
| `spine next --execute` | `spine next -x` |

---

## 📚 Slash Commands (in pi)

| Command | Action |
|---------|--------|
| `/spine` | Preflight + batch start for single task |
| `/spine <task-id>` | Start batch for specific task |
| `/spine pending` | Start batch for pending tasks |
| `/spine-plan <all\|paths>` | Preview waves and lanes |
| `/spine-status` | Reconciled batch diagnosis + lane health |
| `/spine-dismiss` | `spine batch dismiss` |
| `/spine-next` | `spine next` |
| `/spine-pause` | `spine batch pause` |
| `/spine-resume` | `spine batch resume` |
| `/spine-abort` | `spine batch abort` (`--hard` kills workers) |
| `/spine-retry-task <id>` | `spine batch retry` |
| `/spine-skip-task <id>` | `spine batch skip` |
| `/spine-gate` | Gate inspection and resolution |
| `/spine-integrate` | Merge orch to main (after gate approval) |
| `/spine-settings` | Config menu |
| `/spine-deps <all\|paths>` | Show dependency graph |
| `/spine-dashboard` | Start local SSE dashboard in background |
| `/spine-validate` | `spine tasks validate` |
| `/spine-handoff` | `spine handoff` — session handoff artifact |

`/spine` runs `spine preflight` first and blocks batch guidance when preflight fails.

---

## 🐛 Troubleshooting

### Common Issues

| Symptom | Command |
|---------|---------|
| `No active batch` | `spine preflight` then `spine batch start` |
| `preflight failed` | `spine doctor` then check error messages |
| `Batch is paused` | `spine batch resume` |
| `Batch failed` | `spine status --diagnose` then `spine batch retry` |
| `Needs merge` | `spine batch resume --force` |
| `Needs integrate` | `spine integrate` after gate approval |
| `Stale batch` | `spine batch dismiss` |
| `DirtyWorktree` with only `graphify-out/**` after lane commit | Gitignore `graphify-out/`; see [operator-runbook §9 Graphify hook](./adoption/operator-runbook.md#graphify-post-commit-hook-vs-spine-batches) ([#113](https://github.com/beettlle/pi-spine/issues/113)) |

### Debug Mode

```bash
# Enable verbose output
export SPINE_DEBUG=1

# Use stub worker (no pi required) — CI and tests
export SPINE_WORKER_STUB=1

# Simulate task failure for mixed-outcome tests
export SPINE_WORKER_STUB_FAIL_TASKS=TP-998

# Force review stub
export SPINE_REVIEW_STUB=1

# Disable pi agent spawn (worker host only)
export SPINE_WORKER_PI_AGENT=0
```

### Heartbeat and stall

During a batch, the engine polls lane progress (STATUS.md mtime, lane-branch commits) and appends `lane.heartbeat` to the journal on an interval (default 10 minutes). Stall kill uses grace after progress. Configure in `.spine/spine-config.json`:

```json
"lanes": {
  "stallTimeoutMinutes": 120,
  "stallGraceAfterProgressMinutes": 30,
  "heartbeatIntervalMinutes": 10
}
```

Use ≥120 minutes for real `pi` workers. Full stall recovery: [operator-runbook.md](./adoption/operator-runbook.md) §9.

---

## 📖 Further Reading

- [Agent-orchestrated waves](./adoption/agent-orchestrated-waves.md) — Multi-wave outer loop driven by an external agent (pi, OpenCode, Cursor)
- [Upstream execution workflow](./adoption/upstream-execution-workflow.md) — PRD or optional zero-pi / spec-kit → task packets → batch
- [Execution Flow](./EXECUTION-FLOW.md) - Detailed execution explanation
- [Execution Flow Diagrams](./EXECUTION-FLOW-DIAGRAMS.md) - Visual diagrams
- [Product Requirements](./PRD.md) - Full specification
- [Adoption Guide](./adoption/operator-runbook.md) - Operator procedures

---

*Last updated: 2026-07-02*
