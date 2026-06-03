# Task: TP-031 — spine deps CLI + /spine-deps

**Created:** 2026-06-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-031-spine-deps-cli/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Implement **`spine deps`** and wire **`/spine-deps`** so operators can inspect the task dependency graph without running a full batch plan (PRD §15.1, §15.2).

Deliverables:
1. **`spine deps <all|paths> [--json]`** — load tasks from `paths.tasksRoot`, parse `## Dependencies` from PROMPT.md (reuse planner/taskplane parsers), build graph via `src/planner/graph.mjs`, detect cycles, print human table or JSON `{ nodes, edges, cycles, waves? }`.
2. **`/spine-deps <all|paths>`** — slash handler delegates to same core (via `pi.exec` or imported pure function); default scope `all`.
3. **Tests** — cycle detection, empty graph, repo fixture subset (`TP-030` deps only), JSON shape.

**Out of scope:** changing planner wave scheduling; batch execution; editing dependencies.

**Success:** `spine deps all` on this repo prints TP task IDs and edges; `/spine-deps all` no longer shows Phase 0 stub; tests green.

## Dependencies

- **TP-030** — v1.0 tail complete

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`
- `docs/PRD.md` — §15.1 `/spine-deps`, §15.2 CLI

**Tier 3:**
- `src/planner/graph.mjs`, `bin/spine-plan.mjs` — reuse scope + graph patterns
- `src/taskplane/dependencies.mjs` or parser used by planner
- `extensions/spine/slash-commands.ts` — replace `spine-deps` stub

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `src/cli/deps.mjs` (new — pure graph formatting)
- `bin/spine-deps.mjs` (new)
- `bin/spine.mjs` — register `deps` subcommand + help
- `extensions/spine/slash-commands.ts` — `spineDepsHandler`
- `tests/spine-deps.test.mjs` (new)
- `README.md` — mark `/spine-deps` implemented

## Steps

### Step 0: Preflight

- [ ] Read `bin/spine-plan.mjs` scope resolution; inventory dependency parser entry points
- [ ] Baseline: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 1: Core deps module

> **Plan-review checkpoint**

- [ ] Add `src/cli/deps.mjs`:
  - `resolveDepsScope(projectRoot, scopeArg)` → task IDs / paths
  - `buildDepsReport(projectRoot, scope)` → `{ nodes, edges, cycles, error? }`
  - Reuse `buildGraph` / `topoWaves`; surface cycle nodes in `cycles` array
  - Human formatter: one line per edge `A → B`; summary line with node count
- [ ] `tests/spine-deps.test.mjs`: acyclic fixture; synthetic cycle; `--json` parse

**Artifacts:** `src/cli/deps.mjs`, `tests/spine-deps.test.mjs`

### Step 2: CLI + slash

- [ ] `bin/spine-deps.mjs`: `spine deps <all|paths> [--json]`; exit 1 on cycles with `suggestedCommand`
- [ ] Wire `bin/spine.mjs` + help text
- [ ] `spineDepsHandler` in slash-commands: parse args (`all` default); show notify output (truncate if huge)
- [ ] README slash table: `/spine-deps` implemented

**Artifacts:** `bin/spine-deps.mjs`, `bin/spine.mjs`, `extensions/spine/slash-commands.ts`

### Step 3: Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Manual: `spine deps all | head`; `spine deps all --json | jq .nodes | head`

## Completion Criteria

- [ ] `spine deps all` and `--json` work on repo fixtures
- [ ] `/spine-deps` no longer stub
- [ ] New tests pass; full suite green

## Must Update

- `README.md`
- `taskplane-tasks/CONTEXT.md` (Phase 8 row when Done)

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not change batch engine or planner wave assignment
- Do not edit `taskplane-tasks/dependencies.json` parsing format

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
