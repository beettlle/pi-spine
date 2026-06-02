# pi-spine bootstrap checklist

Copy-paste steps to adopt pi-spine on a **greenfield** repo or **migrate from Taskplane**, without touching production until you are ready.

**Prerequisites:** Node.js ≥ 22, Git, [pi](https://pi.dev). Install pi-spine from a checkout first — see [local-install.md](./local-install.md).

## Adoption fixture (smoke target)

The pi-spine repo ships a minimal consumer layout at **`tests/fixtures/adoption-repo/`**:

| Path | Role |
|------|------|
| `taskplane-tasks/AD-001-smoke/` | Review Level 0 smoke task |
| `taskplane-tasks/AD-002-real-pi-smoke/` | Review Level 1 real-pi smoke task |
| `taskplane-tasks/dependencies.json` | Task dependency graph (AD-001, AD-002) |

No `.spine/` config is checked in — bootstrap runs `spine init` on first use. Stub batch completion is marked by **`taskplane-tasks/AD-001-smoke/.DONE`** (worker also touches `DONE.txt` when using real pi).

Run the automated smoke (no network, stub workers):

```bash
./scripts/adoption-smoke.sh
# or from pi-spine repo root:
SPINE_WORKER_STUB=1 node --test tests/adoption/fixture-batch.test.mjs
```

Use this fixture to validate install and batch wiring before pointing spine at your real project.

**Real-pi E2E (manual, optional):** after stub smoke passes, run [`real-pi-e2e.md`](./real-pi-e2e.md) / `./scripts/real-pi-adoption-e2e.sh --batch` against `AD-002-real-pi-smoke`.

---

## Greenfield bootstrap

In a **new or spine-free** application repository:

### 1. Install pi-spine

From your consumer repo (replace with your checkout path):

```bash
pi install /absolute/path/to/pi-spine -l
# optional CLI on PATH:
cd /absolute/path/to/pi-spine && npm link
```

See [local-install.md](./local-install.md) for `file:` dependencies and PATH troubleshooting.

### 2. Initialize spine

```bash
spine init --tasks-root taskplane-tasks --preset taskplane-compat
```

This creates `.spine/spine-config.json`, agent stubs under `.spine/agents/`, and spine gitignore entries.

### 3. Add your first task

Create `taskplane-tasks/<ID>-<slug>/PROMPT.md` (Taskplane-compatible format). Start with **Review Level 0** for wiring checks.

Register dependencies in `taskplane-tasks/dependencies.json` when you have more than one task.

### 4. Doctor

```bash
spine doctor
```

Fix any ❌ failures before starting a batch. ⚠️ warnings (for example stale global `spine` on PATH) are documented in [local-install.md](./local-install.md).

### 5. Plan and preflight

```bash
spine plan pending
spine preflight
```

**Optional — environment overrides (FR-CFG-04):** runtime values override `.spine/spine-config.json` (precedence: **env > file**).

| Variable | Config field | Example |
|----------|--------------|---------|
| `SPINE_TASKS_ROOT` | `paths.tasksRoot` | `SPINE_TASKS_ROOT=alt-tasks spine plan pending` |
| `SPINE_MAX_LANES` | `lanes.maxParallel` | `SPINE_MAX_LANES=2 spine batch start pending` |

Inspect effective values and source with `spine settings show` or `spine doctor` (look for `source: env`).

Resolve reconcile hints (stale batch state, limbo worktrees) before `batch start`.

### 6. First batch (stub, then real pi)

**Stub (CI-safe, no real pi workers):**

```bash
SPINE_WORKER_STUB=1 spine batch start <task-id> --dry-run   # preview
SPINE_WORKER_STUB=1 spine batch start <task-id>
```

**Real pi workers** (after stub path is green):

```bash
SPINE_WORKER_STUB=0 spine batch start <task-id>
```

Monitor with `spine status` or `/spine-status` in pi. After batch completes, follow the land loop per [operator-runbook.md](./operator-runbook.md) (gate → integrate → complete).

---

## Migrate from Taskplane

For repos that already use Taskplane `/orch` and `taskplane-tasks/`:

### 1. Stop Taskplane batches

Do **not** run Taskplane `/orch` and `spine batch start` concurrently on the same repo. `spine doctor` and `spine preflight` inspect **both** `.pi/batch-state.json` (Taskplane) and `.spine/batch-state.json` (pi-spine) and fail with `suggestedCommand` when an active Taskplane batch would conflict (PRD §22.1).

### 2. Install pi-spine

Same as greenfield step 1 — `pi install /path/to/pi-spine -l`.

### 3. Preview config migration

```bash
spine migrate-from-taskplane --dry-run --source .pi/taskplane-config.json
```

Review mapped fields (tasks root, testing commands, lanes, gates).

### 4. Apply migration (or init)

**If `.pi/taskplane-config.json` exists:**

```bash
spine migrate-from-taskplane --source .pi/taskplane-config.json
```

**If no Taskplane config (tasks only):**

```bash
spine init --tasks-root taskplane-tasks --preset taskplane-compat
```

Agent stubs are copied on init; re-run init with `--force` only if you intend to overwrite.

### 5. Doctor, plan, first batch

Same as greenfield steps 4–6. Existing `taskplane-tasks/` folders and `dependencies.json` are reused.

### 6. Retire Taskplane orchestration

After a successful stub batch, remove or disable Taskplane `/orch` usage. Until then, rely on `spine doctor` / `spine preflight` mutual-exclusion checks before each spine batch.

---

## Quick reference

| Step | Command |
|------|---------|
| Install | `pi install /path/to/pi-spine -l` |
| Init (greenfield) | `spine init --tasks-root taskplane-tasks --preset taskplane-compat` |
| Migrate | `spine migrate-from-taskplane --source .pi/taskplane-config.json` |
| Health | `spine doctor` |
| Preview work | `spine plan pending` |
| Preflight | `spine preflight` |
| Stub batch | `SPINE_WORKER_STUB=1 spine batch start <id>` |
| Adoption smoke | `./scripts/adoption-smoke.sh` |

## Related docs

| Doc | Purpose |
|-----|---------|
| [local-install.md](./local-install.md) | Git/path install before npm publish |
| [operator-runbook.md](./operator-runbook.md) | Daily operator procedures |
| [real-project-readiness.md](./real-project-readiness.md) | Phase 9 adoption tiers and task map |
| [README](../../README.md) | Full CLI reference |
