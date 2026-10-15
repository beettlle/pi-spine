# Task: SP-831 — Planner sorts task IDs numerically (SP-999 before SP-1000)

**Created:** 2026-10-15
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** The planner's sort order sets the task order inside each wave, which drives lane assignment and serialized task order on a lane. Wave membership comes from the dependency graph and must not change.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** `compareTaskIds` (`src/tasks/packet/discover.mjs` ~48-61) compares the prefix, then the digits as numbers, and task discovery already sorts with it. The planner still sorts task IDs with plain `.sort()`, which compares strings, so `SP-1000` sorts before `SP-999`. The next task ID is near SP-831, so this starts to matter after SP-999. Plain sorts on task IDs: `src/planner/graph.mjs` lines 40 (`nodes`), 42 (`dependentsByTask[id]`), 72 (first wave), 91 (each later wave), 97 (`remainingWithDeps`); `src/planner/pending.mjs` line 26; `src/planner/scope.mjs` lines 77 (`allTaskIds`) and 138 (resolved scope); `src/cli/deps.mjs` line 58 (nodes) and line 45 (edges, `localeCompare` on `from` / `to`).

## Mission

Closes #352 — Every planner and `spine deps` sort of task IDs uses `compareTaskIds`, so `SP-999` comes before `SP-1000`, and wave membership is unchanged.

1. **Planner sorts:** in `src/planner/graph.mjs`, `src/planner/pending.mjs`, and `src/planner/scope.mjs`, replace each plain `.sort()` on task IDs listed above with `.sort(compareTaskIds)`. Import `compareTaskIds` from `../tasks/packet/discover.mjs` (`scope.mjs` already imports `TASK_ID_RE` from that module; `pending.mjs` imports from `./scope.mjs` — import directly from `discover.mjs` to avoid a new re-export).
2. **`spine deps` output** (`src/cli/deps.mjs`): sort nodes with `compareTaskIds`; sort edges by `compareTaskIds(a.from, b.from) || compareTaskIds(a.to, b.to)`.
3. **Tests:**
   - `tests/planner/graph.test.mjs`: `SP-1000` and `SP-999` with no dependencies form one wave ordered `["SP-999", "SP-1000"]`; a graph where both depend on `SP-100` yields waves `[["SP-100"], ["SP-999", "SP-1000"]]`; `remainingWithDeps` for a cycle containing `SP-999` and `SP-1000` lists `SP-999` first.
   - `tests/planner/pending-scope.test.mjs`: pending task IDs from discovered `SP-1000` and `SP-999` folders come back as `["SP-999", "SP-1000"]`.
   - `tests/planner/scope.test.mjs`: `parseScope` with `all` and with a glob that matches both returns `["SP-999", "SP-1000"]`.

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-831`, which reviews this task's diff with stet (`.review/config.toml`: `qwen/qwen3.8-27b` on LM Studio). When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. Record stet reviewer bugs under Discoveries in STATUS.md. Never dismiss a real defect without fixing it. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Dependencies

- **None**

## Context to Read First

- GitHub #352
- `src/tasks/packet/discover.mjs` 1-62
- `src/planner/graph.mjs` (whole file, 100 lines)
- `src/planner/pending.mjs` 1-30; `src/planner/scope.mjs` 1-20, 70-80, 125-149
- `src/cli/deps.mjs` 1-60
- `tests/tasks/discover-boundary.test.mjs` (existing SP-999 / SP-1000 fixtures)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only. The batch exports `STET_CRITIC_ENABLED=false`, so the OpenJev critic is not used.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/planner/graph.mjs`
- `src/planner/pending.mjs`
- `src/planner/scope.mjs`
- `src/cli/deps.mjs`
- `tests/planner/graph.test.mjs`
- `tests/planner/pending-scope.test.mjs`
- `tests/planner/scope.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/planner/graph.test.mjs tests/planner/pending-scope.test.mjs tests/planner/scope.test.mjs tests/planner/integration.test.mjs tests/tasks/discover-boundary.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-831` |
| fileScopeMustChange | `src/planner/graph.mjs`, `src/planner/pending.mjs`, `src/planner/scope.mjs`, `tests/planner/graph.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `buildGraph`, `topoWaves`, `parseScope`, and the pending-list function in `pending.mjs` — record callers in Discoveries
- [ ] `rg -n '\.sort\(' src/planner src/cli/deps.mjs` — every task-ID sort is in the Mission list (record any other as a Discovery)
- [ ] Dependencies satisfied

### Step 1: Numeric sorts

- [ ] `graph.mjs`, `pending.mjs`, `scope.mjs` use `compareTaskIds`
- [ ] `deps.mjs` nodes and edges use `compareTaskIds`

**Artifacts:**
- `src/planner/graph.mjs` (modified)
- `src/planner/pending.mjs` (modified)
- `src/planner/scope.mjs` (modified)
- `src/cli/deps.mjs` (modified)

### Step 2: Tests

- [ ] Graph wave order and `remainingWithDeps`
- [ ] Pending list order
- [ ] `parseScope` `all` and glob order

**Artifacts:**
- `tests/planner/graph.test.mjs` (modified)
- `tests/planner/pending-scope.test.mjs` (modified)
- `tests/planner/scope.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-831-planner-numeric-task-id-sort/.DONE` (this task folder, not the worktree root)

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] No planner or `spine deps` sort orders task IDs as strings
- [ ] `SP-999` sorts before `SP-1000` in waves, pending lists, and scope resolution
- [ ] Existing planner tests pass unchanged (wave membership is unchanged)

## Git Commit Convention

- `fix(SP-831): sort planner task IDs numerically (#352)`

## Do NOT

- Change `compareTaskIds`, `TASK_ID_RE`, or wave membership logic in `topoWaves`
- Sort non-task-ID lists (paths, batch IDs) with `compareTaskIds`
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
