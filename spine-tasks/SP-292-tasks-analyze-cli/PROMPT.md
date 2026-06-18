# Task: SP-292 — tasks analyze CLI

**Created:** 2026-06-18
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** New CLI subcommand with structural analysis logic and tests; complements `spine tasks validate`.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Add **`spine tasks analyze <scope>`** — deterministic, read-only structural checks on pending task packets before batch start. Complements contract validation (`spine tasks validate`) and skill-level LLM analyze (SP-291).

**Checks (blocking vs warning):**
| Check | Severity |
|-------|----------|
| Parallel-eligible tasks (same wave, no dep edge) with overlapping `## File Scope` | blocking |
| Pending wave with >4 M-sized tasks | warning |
| `dependencies.json` cycles or orphan task IDs | blocking |
| PROMPT `## Dependencies` not reflected in JSON (beyond validate warnings) | warning |
| Task references explore slug in CONTEXT but `findings.md` missing | warning |

**Output:** human-readable report + `--json`; exit 0 when no blocking issues, exit 1 when blocking issues present (warnings alone exit 0).

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `bin/spine-tasks.mjs` — validate subcommand patterns
- `src/planner/graph.mjs` — dependency graph
- `src/planner/lanes.mjs` — parallel wave logic
- `tests/tasks/validate-cli.test.mjs` — CLI test patterns

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-tasks.mjs`
- `src/tasks/analyze/index.mjs`
- `tests/tasks/analyze-cli.test.mjs`
- `docs/QUICK-REFERENCE.md`
- `docs/adoption/upstream-execution-workflow.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | bin/spine-tasks.mjs, src/tasks/analyze/index.mjs, tests/tasks/analyze-cli.test.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/tasks/analyze-cli.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Review `spine tasks validate` scope resolution and JSON shape
- [ ] List blocking vs warning checks from mission table

### Step 1: Analyze module

> **Plan-review checkpoint**

- [ ] Create `src/tasks/analyze/index.mjs` with `analyzeTasksScope({ projectRoot, scope })`
- [ ] Implement scope overlap detection for parallel-eligible tasks
- [ ] Implement deps graph cycle/orphan checks
- [ ] Implement wave size and explore-reference warnings

### Step 2: CLI wiring and tests

> **Code review checkpoint**

- [ ] Add `spine tasks analyze` to `bin/spine-tasks.mjs` with `--json` flag
- [ ] `tests/tasks/analyze-cli.test.mjs`: overlap blocking, clean scope passes, cycle fails, warnings-only exits 0
- [ ] Update help text in `bin/spine.mjs` if tasks help is duplicated there

### Step 3: Testing & Verification

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run targeted: `node --test tests/tasks/analyze-cli.test.mjs`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 4: Documentation & Delivery

- [ ] QUICK-REFERENCE: `spine tasks analyze` entry
- [ ] upstream-execution-workflow: mention analyze after validate
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/QUICK-REFERENCE.md`
- `docs/adoption/upstream-execution-workflow.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-292): complete Step N — description`
- `test(SP-292): description`

## Do NOT

- Invoke LLM or external APIs in analyze CLI
- Block batch start automatically (analyze is operator-opt-in preflight)

---

## Amendments (Added During Execution)
