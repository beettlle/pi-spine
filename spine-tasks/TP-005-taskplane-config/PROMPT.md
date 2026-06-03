# Task: TP-005 — Harden Taskplane config and agent overrides

**Created:** 2026-05-31
**Size:** S

## Review Level: 0 (None)

**Assessment:** Config and documentation-only changes to agent prompts; no runtime orchestration logic.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Fix placeholder Taskplane testing commands and add project-specific agent guidance so `/orch` workers know how to build, test, and commit in pi-spine.

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `.pi/taskplane-config.json`
- `.pi/agents/task-worker.md` (and reviewer, supervisor templates)
- `package.json` — available npm scripts

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `.pi/taskplane-config.json`
- `.pi/agents/task-worker.md`
- `.pi/agents/task-reviewer.md`
- `.pi/agents/supervisor.md`

## Steps

### Step 0: Preflight

- [ ] Read current `.pi/taskplane-config.json` testing placeholders
- [ ] Read empty agent override templates

### Step 1: Fix Taskplane testing config

- [ ] Set `taskRunner.testing.commands.unit` to `npm run typecheck` (and `npm test` once script exists — use `npm run typecheck && npm test` if test script present at execution time)
- [ ] Set `taskRunner.testing.commands.build` to `npm run typecheck`
- [ ] Add `taskRunner.project.description` summarizing pi-spine

**Artifacts:**
- `.pi/taskplane-config.json` (modified)

### Step 2: Populate agent overrides

- [ ] `task-worker.md`: npm (not pnpm), commit prefix `{taskId} step {n}:`, run `npm run typecheck` during steps, full `npm test` at gate, ESM/Node 22+, match existing code style
- [ ] `task-reviewer.md`: review for scope creep, missing tests, Taskplane packet conventions
- [ ] `supervisor.md`: prefer `/orch` for batches; note dual Taskplane/pi-spine orchestrator mutual exclusion from PRD §22.1

**Artifacts:**
- `.pi/agents/task-worker.md` (modified)
- `.pi/agents/task-reviewer.md` (modified)
- `.pi/agents/supervisor.md` (modified)

### Step 3: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Validate JSON: `node -e "JSON.parse(require('fs').readFileSync('.pi/taskplane-config.json','utf8'))"`

### Step 4: Documentation & Delivery

- [ ] Update `taskplane-tasks/CONTEXT.md` Current State if needed
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `taskplane-tasks/CONTEXT.md` — note testing commands configured (if not already)

## Completion Criteria

- [ ] No placeholder testing command strings remain
- [ ] Agent overrides contain actionable project rules

## Git Commit Convention

- **Step completion:** `feat(TP-005): complete Step N — description`

## Do NOT

- Modify `bin/`, `extensions/`, or application source
- Change orchestrator maxLanes or task area structure

---

## Amendments (Added During Execution)
