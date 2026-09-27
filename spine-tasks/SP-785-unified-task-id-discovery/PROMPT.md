# Task: SP-785 — Unified task-ID discovery (SP-1000+)

**Created:** 2026-09-27
**Size:** M

## Review Level: 1 (Plan Only)

**Risk:** Task discovery feeds the planner, preflight, and worker runner; a pattern change can hide or add tasks across all of them.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** The planner's `TASK_FOLDER_RE` accepts exactly three digits while preflight accepts three or more, so from SP-1000 on tasks silently vanish from `spine plan` and batches while preflight still counts them. IDs sort as text (SP-1000 before SP-999). Prefix rules differ (planner allows `X-001`, preflight needs two letters), preflight's `discoverTaskFolders` applies no pattern at all (counts `_explore`), and the worker prompt/runner have their own `/^([A-Z]+-\d+)/` parsers.

## Mission

Closes #300 — One task-ID pattern and one folder pattern, numeric ordering, and every discovery site agreeing.

1. **Single source of truth** in `src/tasks/packet/discover.mjs`: export `TASK_ID_PATTERN_SOURCE` (or equivalent) plus `TASK_ID_RE = /^[A-Z][A-Z0-9]*-\d{3,}$/`, `TASK_FOLDER_RE = /^([A-Z][A-Z0-9]*-\d{3,})-([a-z0-9][a-z0-9-]*)$/`, a `taskIdFromFolderName(name)` helper, and a `compareTaskIds(a, b)` comparator (prefix, then `Number(digits)`). Keep the planner's existing prefix rule (`[A-Z][A-Z0-9]*`) so no currently-discovered task disappears.
2. **Numeric sort** — `discoverTasks` sorts with `compareTaskIds`: SP-099 < SP-999 < SP-1000.
3. **Preflight delegates** — `discoverTaskFolders` / `discoverTaskIds` / `taskIdFromFolder` in `src/config/preflight/discovery.mjs` derive from `discoverTasks` (or the shared regex), so `checkTasksRoot` and `checkDependenciesJson` agree with the planner and no longer count `_explore`, `_authoring`, `_archive`.
4. **Planner re-export** — `src/planner/scope.mjs` `TASK_ID_RE` re-exports the shared regex instead of redefining it.
5. **Worker parsers** — `taskIdFromFolder` in `src/batch/worker-prompt.mjs` and the stub parser in `bin/spine-worker-runner.mjs` (~line 315) use the shared helper. `worker-prompt.mjs` keeps its `"TASK-ID"` fallback.
6. **Tests** — boundary test with folders `SP-099-baz`, `SP-999-foo`, `SP-1000-bar`, `X-001-single`, `_explore`: planner, preflight, and worker helper return the same IDs in numeric order; a guard test asserts `discovery.mjs`, `scope.mjs`, `worker-prompt.mjs`, and `spine-worker-runner.mjs` contain no private task-ID regex literal.

## Dependencies

- **None**

## Context to Read First

- `src/tasks/packet/discover.mjs` (40 lines) and `src/tasks/packet/index.mjs` re-export
- `src/config/preflight/discovery.mjs` — lines 15, 34–52, and callers at ~80 and ~161
- `src/planner/scope.mjs` line 15; `src/planner/pending.mjs` line 57
- `src/batch/worker-prompt.mjs` ~line 83; `bin/spine-worker-runner.mjs` ~lines 125, 315, 413
- `tests/spine-preflight.test.mjs` ~line 247; `tests/batch/worker-prompt.test.mjs` ~line 52
- GitHub #300

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/tasks/packet/discover.mjs`
- `src/config/preflight/discovery.mjs`
- `src/planner/scope.mjs`
- `src/batch/worker-prompt.mjs`
- `bin/spine-worker-runner.mjs`
- `tests/tasks/discover-boundary.test.mjs`
- `tests/spine-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/tasks/discover-boundary.test.mjs tests/spine-preflight.test.mjs tests/batch/worker-prompt.test.mjs tests/planner/*.test.mjs` |
| fileScopeMustChange | `src/tasks/packet/discover.mjs`, `src/config/preflight/discovery.mjs`, `tests/tasks/discover-boundary.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce the #300 discovery mismatch with the five-folder fixture
- [ ] `rg -n 'TASK_FOLDER_RE|TASK_ID_RE|taskIdFromFolder|-\\d' src bin tests` — list every consumer and private ID regex
- [ ] Dependencies satisfied

### Step 1: Shared patterns + numeric sort

- [ ] Shared regexes, `taskIdFromFolderName`, `compareTaskIds` exported from `discover.mjs`
- [ ] `discoverTasks` uses `\d{3,}` and numeric sort
- [ ] `scope.mjs` re-exports the shared `TASK_ID_RE`

**Artifacts:**
- `src/tasks/packet/discover.mjs`, `src/planner/scope.mjs` (modified)

### Step 2: Preflight + worker delegation

- [ ] `discovery.mjs` discovery helpers delegate; non-task folders excluded
- [ ] `worker-prompt.mjs` and `spine-worker-runner.mjs` use the shared helper

**Artifacts:**
- `src/config/preflight/discovery.mjs`, `src/batch/worker-prompt.mjs`, `bin/spine-worker-runner.mjs` (modified)

### Step 3: Boundary + guard tests

- [ ] Planner/preflight/worker parity on the five-folder fixture, numeric order
- [ ] Guard test: no private task-ID regex literals in the four consumer files
- [ ] Update `tests/spine-preflight.test.mjs` expectations if non-task folders were counted

**Artifacts:**
- `tests/tasks/discover-boundary.test.mjs` (new)
- `tests/spine-preflight.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run full suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] `spine plan all` on this repo still lists the same task count as before (record both numbers)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/PRD.md` §13 task folder naming (FR-TASK-01) — note if it says "three digits"

## Completion Criteria

- [ ] SP-1000 discovered by planner, preflight, and worker runner
- [ ] Ordering SP-099 < SP-999 < SP-1000
- [ ] `checkTasksRoot` ignores non-task folders
- [ ] One task-ID regex, guarded by a test
- [ ] Closes #300

## Git Commit Convention

- `fix(SP-785): unify task-ID discovery and sort numerically (#300)`

## Do NOT

- Rename existing task folders
- Tighten the prefix rule in a way that drops any currently-discovered folder
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
