# Task: TP-007 — Taskplane compatibility parsers

**Created:** 2026-05-31
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Foundational parsers for all downstream scheduling; incorrect parsing breaks wave plans, worker context, and dependency merge.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement Phase 1 Taskplane-compatible task parsers (FR-TASK-01 through FR-TASK-05): discover task packets, parse PROMPT and STATUS sections, merge dependencies from PROMPT and `dependencies.json` (JSON wins conflicts). Ship golden fixtures in `test/fixtures/taskplane/` and conformance tests in `tests/compat/` per PRD §13.

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `pi-spine-PRD.md` — §7.2 FR-TASK, **§13 Taskplane compatibility specification**
- [Taskplane task format](https://github.com/HenryLach/taskplane/blob/main/docs/reference/task-format.md)
- [Taskplane status format](https://github.com/HenryLach/taskplane/blob/main/docs/reference/status-format.md)
- Existing task packets under `taskplane-tasks/TP-00*` as live examples

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/compat/taskplane/**` (new)
- `tests/compat/**` (new)
- `test/fixtures/taskplane/**` (new)

## Steps

### Step 0: Preflight

- [ ] Read PRD §13.1–§13.5 and FR-TASK-01 through FR-TASK-05
- [ ] Review Taskplane reference docs for heading regex and required PROMPT sections
- [ ] Inventory existing `taskplane-tasks/` packets for fixture source material

### Step 1: Task discovery and PROMPT parsing

> **Plan-review checkpoint** — confirm module layout and parsed object shape before STATUS/deps work.

- [ ] Create `src/compat/taskplane/discover.mjs` — FR-TASK-01: find `{tasksRoot}/{PREFIX-###-slug}/PROMPT.md`
- [ ] Create `src/compat/taskplane/parse-prompt.mjs` — FR-TASK-02: heading `# Task: PREFIX-### — Name` (em dash required)
- [ ] Parse required sections in `parse-prompt.mjs` — FR-TASK-03: Mission, Dependencies, File Scope, Steps, Testing, Completion Criteria, Do NOT
- [ ] Export stable typed/plain objects for planner consumption (task id, title, fileScope paths, step list)

**Artifacts:**
- `src/compat/taskplane/discover.mjs` (new)
- `src/compat/taskplane/parse-prompt.mjs` (new)

### Step 2: STATUS parsing

- [ ] Create `src/compat/taskplane/parse-status.mjs` — FR-TASK-04: mirror step numbers; checkbox state drives progress
- [ ] Export helpers: `getStepProgress(status)`, `listIncompleteSteps(status)`

**Artifacts:**
- `src/compat/taskplane/parse-status.mjs` (new)

### Step 3: Dependency merge

- [ ] Create `src/compat/taskplane/merge-deps.mjs` — FR-TASK-05: `parse_prompt_deps(task) ∪ dependencies.json[task]`; JSON wins conflicts
- [ ] Create `src/compat/taskplane/index.mjs` re-exporting discover + parse + merge API

**Artifacts:**
- `src/compat/taskplane/merge-deps.mjs` (new)
- `src/compat/taskplane/index.mjs` (new)

### Step 4: Golden fixtures and compat tests

- [ ] Add three golden fixtures (S/M/L complexity) under `test/fixtures/taskplane/` with PROMPT.md, STATUS.md, and sample `dependencies.json`
- [ ] Add `tests/compat/taskplane-prompt.test.mjs` — heading regex, section presence, em-dash enforcement
- [ ] Add `tests/compat/taskplane-status.test.mjs` — checkbox progress parsing
- [ ] Add `tests/compat/taskplane-deps.test.mjs` — merge algorithm including JSON-wins conflict case
- [ ] Run targeted tests: `node --test tests/compat/*.test.mjs`

**Artifacts:**
- `test/fixtures/taskplane/**` (new)
- `tests/compat/**` (new)

### Step 5: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Run `npm test` (full suite)
- [ ] Verify parsers load all committed `taskplane-tasks/TP-00*` packets without error

### Step 6: Documentation & Delivery

- [ ] Add brief module README or JSDoc on public exports in `src/compat/taskplane/index.mjs`
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `src/compat/taskplane/index.mjs` — module-level usage comment for planner (TP-008)

## Completion Criteria

- [ ] FR-TASK-01 through FR-TASK-05 satisfied with passing compat tests
- [ ] Golden fixtures pinned per PRD §13.5
- [ ] Typecheck and tests pass

## Git Commit Convention

- **Step completion:** `feat(TP-007): complete Step N — description`

## Do NOT

- Implement scheduling, waves, or lane assignment (TP-008)
- Implement batch preflight checks (TP-006)
- Mutate task packets at runtime (read-only parsers)

---

## Amendments (Added During Execution)
