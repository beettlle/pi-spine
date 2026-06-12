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

```bash
# Run preflight validation (required before batch start)
spine preflight

# JSON output for automation
spine preflight --json
```

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

```bash
# Status with diagnosis
spine status

# Verbose diagnosis
spine status --diagnose

# JSON output
spine status --json

# Include segment frontier
spine status --verbose
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

# Approve gate (if required)
spine gate approve

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

```bash
# Reconciled batch diagnosis
spine status

# Verbose diagnosis
spine status --diagnose

# JSON output
spine status --json

# Next suggested command (dry-run)
spine next

# Execute next command
spine next --execute
```

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

### Task Discovery

```bash
# List discovered tasks
spine tasks list

# Show task details
spine tasks show TP-012
```

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
| `/spine-plan <all\|paths>` | Preview waves and lanes |
| `/spine-status` | Reconciled batch diagnosis |
| `/spine-dismiss` | `spine batch dismiss` |
| `/spine-next` | `spine next` |
| `/spine-pause` | `spine batch pause` |
| `/spine-resume` | `spine batch resume` |
| `/spine-abort` | `spine batch abort` |
| `/spine-gate` | Gate inspection |
| `/spine-integrate` | Merge orch to main |
| `/spine-settings` | Config menu |
| `/spine-deps <all\|paths>` | Show dependency graph |

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

### Debug Mode

```bash
# Enable verbose output
export SPINE_DEBUG=1

# Use stub worker (no pi required)
export SPINE_WORKER_STUB=1

# Force review stub
export SPINE_REVIEW_STUB=1
```

---

## 📖 Further Reading

- [Execution Flow](./EXECUTION-FLOW.md) - Detailed execution explanation
- [Execution Flow Diagrams](./EXECUTION-FLOW-DIAGRAMS.md) - Visual diagrams
- [Product Requirements](./PRD.md) - Full specification
- [Adoption Guide](./adoption/operator-runbook.md) - Operator procedures

---

*Last updated: 2026-06-12*
