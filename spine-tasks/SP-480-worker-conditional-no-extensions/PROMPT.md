# Task: SP-480 — Worker conditional pi -ne for extension conflicts

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Narrow guard fix: unconditional `-ne` broke Cursor models; only disable extensions when doctor detects conflict.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

SP-450 added unconditional `pi -ne` on batch workers, which hides Cursor provider extensions and breaks `cursor/composer-latest` / `cursor/auto` worker spawns. Pass `-ne` only when `detectPiWebAccessExtensionConflict()` reports a duplicate pi-web-access source; otherwise spawn with extensions so Cursor models resolve. Update doctor hint, runbook, and tests.

## Dependencies

- **Task:** SP-450 (doctor module + worker-runner integration)

## Context to Read First

- `src/doctor/pi-extension-conflict.mjs`
- `bin/spine-worker-runner.mjs` — `buildWorkerPiArgs`, `formatPiExtensionConflictHint`
- `tests/agents/worker-runner.test.mjs`
- `docs/adoption/operator-runbook.md` — pi-web-access section

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-worker-runner.mjs`
- `src/doctor/pi-extension-conflict.mjs`
- `tests/agents/worker-runner.test.mjs`
- `tests/doctor/extension-conflict.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/extension-conflict.test.mjs tests/agents/worker-runner.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight cleanup

- [ ] If a failed batch blocks the tree (`spine status --diagnose` → `merge_blocked` or stale batch): `spine batch dismiss --reason sp-480-preflight` (worktree cleanup runs when `lanes.cleanupWorktreesOnComplete` is true)
- [ ] Stash or commit unrelated WIP so `spine preflight` passes `git-clean`
- [ ] Run `spine preflight` — all checks pass before implementation batch

### Step 1: Conditional -ne in worker argv

- [ ] Export `shouldWorkerUsePiNoExtensions()` (or equivalent) from `pi-extension-conflict.mjs` using `detectPiWebAccessExtensionConflict`
- [ ] `buildWorkerPiArgs` prepends `-ne` only when conflict is detected
- [ ] Update `formatPiExtensionConflictHint` and doctor check copy (conditional, not always `-ne`)

### Step 2: Testing & Verification

- [ ] Test: no conflict → argv has no `-ne`
- [ ] Test: conflict (temp PI_AGENT_DIR) → `-ne` before `-p`
- [ ] Run contract `testCommand`; fix failures

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook pi-web-access section (conditional `-ne`)
- [ ] Update `spine-tasks/CONTEXT.md` (SP-480 row, Next Task ID → SP-481)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — pi-web-access extension conflicts

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Contract testCommand passes
- [ ] Preflight cleanup step documented and run before batch

## Git Commit Convention

- `fix(SP-480): description`

## Do NOT

- Reopen SP-450 or close #104 again
- Add reactive retry on spawn failure (defer to SP-481 if needed)
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

*Immutable above this line. Worker updates STATUS.md below.*
