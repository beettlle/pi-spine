# pi-spine bootstrap checklist

Copy-paste steps to adopt pi-spine on a **greenfield** repo or **migrate from Taskplane**, without touching production until you are ready.

**Prerequisites:** Node.js ≥ 22, Git, [pi](https://pi.dev). Install pi-spine from a checkout first — see [local-install.md](./local-install.md).

## Tasks root decision

Greenfield and Taskplane migration paths intentionally use different default folders. Pick one root per repo and keep `paths.tasksRoot` (or `SPINE_TASKS_ROOT`) aligned.

| Situation | Tasks root | Command / source |
|-----------|------------|------------------|
| **Greenfield** (new spine project) | `spine-tasks/` | `spine init` |
| **Taskplane migrant** (existing `taskplane-tasks/`) | `taskplane-tasks/` | `spine migrate-from-taskplane` or `spine init --tasks-root taskplane-tasks` |
| **Custom layout** | Your folder name | Set `paths.tasksRoot` in `.spine/spine-config.json` or `SPINE_TASKS_ROOT` env |
| **Adoption fixture** (pi-spine smoke only) | `taskplane-tasks/` | Pre-seeded under `tests/fixtures/adoption-repo/` |

Both roots use the same packet format (`PROMPT.md`, `STATUS.md`, `dependencies.json`). Completion markers live at `<tasksRoot>/<task-id>/.DONE`. `spine doctor` and `spine plan` read the configured root — mixing folders without updating config will hide tasks.

**Upstream authoring (v1.3):** Before your first batch, read [upstream-execution-workflow.md](./upstream-execution-workflow.md) — how PRDs (or optional [zero-pi](https://pi.dev/packages/@gonrocca/zero-pi) explore/plan, or [spec-kit](https://github.com/github/spec-kit) constitution → spec → plan → tasks) become task packets, then `spine tasks validate` → `spine batch start`. pi-spine does not depend on zero-pi or spec-kit.

---

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

### 1. Read the quick start (README)

Follow the **[README quick start](../../README.md#quick-start)** for the high-level path: install → preflight/plan → batch → monitor → land.

For command detail and daily procedures, use **[QUICK-REFERENCE.md](../QUICK-REFERENCE.md)**, **[EXECUTION-FLOW.md](../EXECUTION-FLOW.md)**, and **[operator-runbook.md](./operator-runbook.md)**.

### 2. Install pi-spine

From your consumer repo (replace with your checkout path):

```bash
pi install /absolute/path/to/pi-spine -l
# optional CLI on PATH:
cd /absolute/path/to/pi-spine && npm link
```

See [local-install.md](./local-install.md) for `file:` dependencies and PATH troubleshooting.

**Optional — Cursor IDE rules:** If you develop with [Cursor](https://cursor.com), open the pi-spine checkout as the workspace. Rules under [`.cursor/rules/`](../../.cursor/rules/) load automatically in the IDE. For this repo, the primary subset is JavaScript/CLI (`javascript-3-development-standards.mdc`, `general-llm-anti-patterns.mdc`, `critical-rules-quick-reference.mdc`) plus task authoring (`taskplane-task-authoring.mdc`, `taskplane-worker-cursor.mdc`). Other language packs (Swift, Python, AWS, etc.) are optional. Phase audits: [`.cursor/rules/audit-workflow.mdc`](../../.cursor/rules/audit-workflow.mdc).

**Spine batch workers (FR-WORK-05):** When `.cursor/rules/` exists, `spine init` copies `.spine/rules-profile.json`, runs discovery, and writes **`.spine/rules-manifest.json`** (committed to git). Workers auto-select rules per task using PROMPT File Scope (micromatch glob match) plus profile always-includes (`taskplane-worker-cursor.mdc` by default). Non-empty `config.standards` **append** after auto-selection. See [cursor-rules-discovery.md](../design/cursor-rules-discovery.md).

### 3. Initialize spine

```bash
spine init
```

This creates `.spine/spine-config.json`, agent stubs under `.spine/agents/`, `spine-tasks/`, `docs/constitution.md` (editable principles scaffold listed in `referenceDocs`), and spine gitignore entries (testing commands, gates, dashboard port, lane defaults). When `.cursor/rules/` exists, init also copies `.spine/rules-profile.json`, runs `spine rules discover`, and writes `.spine/rules-manifest.json` — **commit the manifest** to git.

Edit `docs/constitution.md` before your first task packets so Mission and non-negotiable rules reflect your project.

### 4. Add your first task

**Option A — authoring skill (recommended for PRD/epic work):**

In pi (after `pi install /path/to/pi-spine -l`), ask the agent to use the **`create-spine-tasks`** skill:

```text
Use create-spine-tasks to decompose docs/PRD.md into spine-tasks/ packets.
Start with Review Level 0 for a wiring smoke task, then M-sized implementation tasks.
Update spine-tasks/CONTEXT.md and dependencies.json.
```

Skill reference: [`skills/create-spine-tasks/SKILL.md`](../../skills/create-spine-tasks/SKILL.md).

**Option B — manual packet:**

Create `spine-tasks/<ID>-<slug>/PROMPT.md` (spine task packet format; Taskplane-interoperable). Start with **Review Level 0** for wiring checks.

Register dependencies in `spine-tasks/dependencies.json` when you have more than one task.

### 5. Doctor

```bash
spine doctor
```

Fix any ❌ failures before starting a batch. ⚠️ warnings (for example stale global `spine` on PATH) are documented in [local-install.md](./local-install.md).

### 6. Plan and preflight

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

### 7. First batch (stub, then real pi)

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

Same as greenfield step 2 — `pi install /path/to/pi-spine -l`.

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
spine init --tasks-root taskplane-tasks
```

Agent stubs are copied on init; re-run init with `--force` only if you intend to overwrite.

### 5. Doctor, plan, first batch

Same as greenfield steps 5–7. Existing `taskplane-tasks/` folders and `dependencies.json` are reused.

### 6. Retire Taskplane orchestration

After a successful stub batch, remove or disable Taskplane `/orch` usage. Until then, rely on `spine doctor` / `spine preflight` mutual-exclusion checks before each spine batch.

---

## Verification

From pi-spine repo root (contributors and pre-publish validation):

```bash
npm run typecheck && npm test
```

Full suite: **567** tests (`npm test`). Targeted subsets:

| Command | Scope |
|---------|-------|
| `npm run test:core` | All suites except `tests/batch/` |
| `npm run test:batch` | `tests/batch/*.test.mjs` only |
| `npm run coverage:check` | Full suite + ≥77% line coverage gate (SP-061) |

Use `npm run test:batch` or `npm run test:core` instead of appending directory paths to `npm test` (Node treats bare directories as test modules and reports false failures).

---

## Quick reference

| Step | Command |
|------|---------|
| Install | `pi install /path/to/pi-spine -l` |
| Init (greenfield) | `spine init` |
| Init (Taskplane tasks folder) | `spine init --tasks-root taskplane-tasks` or `spine migrate-from-taskplane` |
| Migrate | `spine migrate-from-taskplane --source .pi/taskplane-config.json` |
| Health | `spine doctor` |
| Rules sync | `spine rules sync` (after `.cursor/rules/` changes) |
| Preview work | `spine plan pending` |
| Preflight | `spine preflight` |
| Stub batch | `SPINE_WORKER_STUB=1 spine batch start <id>` |
| Adoption smoke | `./scripts/adoption-smoke.sh` |
| Task authoring | `create-spine-tasks` skill in pi (see step 4) |

## Related docs

| Doc | Purpose |
|-----|---------|
| [local-install.md](./local-install.md) | Git/path install before npm publish |
| [operator-runbook.md](./operator-runbook.md) | Daily operator procedures |
| [real-project-readiness.md](./real-project-readiness.md) | Phase 9 adoption tiers and task map |
| [README](../../README.md) | Project overview and quick start |
| [QUICK-REFERENCE.md](../QUICK-REFERENCE.md) | Operator command reference |
| [EXECUTION-FLOW.md](../EXECUTION-FLOW.md) | Batch lifecycle and scheduling |
| [cursor-rules-discovery.md](../design/cursor-rules-discovery.md) | Cursor rules auto-discovery for workers |
