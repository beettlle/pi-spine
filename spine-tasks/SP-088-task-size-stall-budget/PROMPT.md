# Task: SP-088 — Per-task stall budget from PROMPT Size

**Created:** 2026-06-04
**Size:** M

## Review Level: 2 (Plan + Code)

**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Parse `**Size:**` from PROMPT.md and apply a per-task minimum stall timeout so M/L tasks get longer budgets than global defaults. Wire into `resolveStallConfig` / `worker-host.mjs` without changing stub test timings.

## Dependencies

- **Task:** SP-087

## File Scope

- `src/tasks/packet/parse-prompt.mjs`
- `src/batch/task-stall-budget.mjs` (new)
- `src/batch/heartbeat.mjs`
- `src/batch/worker-host.mjs`
- `tests/batch/task-stall-budget.test.mjs` (new)

## Steps

### Step 1: Parse Size + budget table

> **Plan-review checkpoint**

- [ ] Export `parseTaskSize(markdown)` → S|M|L|null; validate in `validatePrompt` (reject XL)
- [ ] `resolveTaskStallMinutes(size, config)` — S:90, M:180, L:300; use max(config, size)

### Step 2: Wire worker stall loop

> **Code review checkpoint**

- [ ] `runWorker` loads size from taskFolder PROMPT; passes to `resolveStallConfig`
- [ ] Journal `task.stall_budget` optional debug event

### Step 3: Testing & Verification

- [ ] Unit tests for size parse + budget merge
- [ ] FULL suite + coverage ≥77%

## Git Commit Convention

- `feat(SP-088): complete Step N — description`

---

## Amendments (Added During Execution)
