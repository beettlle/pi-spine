# Task: SP-298 — tasks analyze module

**Created:** 2026-06-18
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Core analyze logic — blocking checks for overlap and dependency graph.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement `analyzeTasksScope` core module (parent SP-292).

**Blocking checks:**
- Parallel-eligible tasks with overlapping `## File Scope`
- `dependencies.json` cycles or orphan task IDs

Return structured findings with severity blocking vs warning (warnings implemented in SP-299).

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

```bash
spine settings set agents.worker.model cursor/auto
spine settings set agents.reviewer.model google/gemini-3.1-pro-preview
```

## Context to Read First

- `spine-tasks/SP-292-tasks-analyze-cli/PROMPT.md`
- `bin/spine-tasks.mjs`
- `src/planner/graph.mjs`
- `src/planner/lanes.mjs`
- `tests/tasks/validate-cli.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/analyze/index.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/tasks/analyze/index.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | src/tasks/analyze/index.mjs |

## Steps

### Step 0: Preflight

- [ ] Review `spine tasks validate` scope resolution
- [ ] List blocking vs warning checks from SP-292 mission

### Step 1: Analyze module

> **Plan-review checkpoint**

- [ ] Create `src/tasks/analyze/index.mjs` with `analyzeTasksScope({ projectRoot, scope })`
- [ ] File-scope overlap for parallel-eligible tasks
- [ ] Deps graph cycle/orphan checks

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-298): complete Step N — description`
- `fix(SP-298): description`
- `test(SP-298): description`

## Do NOT

- Wire CLI in this slice (SP-299)
- Invoke LLM or external APIs
---

## Amendments (Added During Execution)
