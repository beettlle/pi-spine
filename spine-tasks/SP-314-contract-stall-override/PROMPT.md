# Task: SP-314 — Contract stall timeout override

**Created:** 2026-06-20
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Operator matrix tasks exceed global `stallTimeoutMinutes: 120` during long external jobs; Size-based floors (SP-088) are insufficient when S-sized operator packets run 2+ hour matrix arms with no file-scope progress signals.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #19**: batch `20260620T043504` — SP-029 (matrix arms A3/A4) hit `stall_timeout` at 120 minutes while Step 2 matrix run was still in progress. Worker had committed Step 1; only dirty path was in-scope `STATUS.md`. Operator workaround: raise global `stallTimeoutMinutes` to 240.

**Required behavior:**

1. **Contract override:** Optional `stallTimeoutMinutes` field in PROMPT `## Contract` table; parsed and applied via `resolveStallConfigForTask` (max of global, size floor, contract override).
2. **Worker + stall alignment:** Contract override flows to worker-host stall loop and `SPINE_WORKER_PI_TIMEOUT_MS` / pi spawn budget (same source as SP-088/SP-202).
3. **Optional grace:** When contract sets `extendGraceOnFileScope: true` (or documents `fileScopeMustChange` paths), honor `lanes.extendGraceOnFileScope` semantics for those paths during long external jobs.
4. **Authoring guidance:** Document operator matrix packet pattern in operator-runbook (recommended `stallTimeoutMinutes: 240` for 2h+ external jobs).
5. **Regression test:** S-sized task with contract `stallTimeoutMinutes: 240` survives stub stall poll beyond 120m equivalent (scaled test timings).

**Closes:** [#19](https://github.com/beettlle/pi-spine/issues/19)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #19
- `src/batch/task-stall-budget.mjs` — SP-088 size floors
- `src/batch/heartbeat.mjs` — stall detection, `extendGraceOnFileScope`
- `src/batch/worker-host.mjs` — per-task stall config wiring
- `src/tasks/packet/parse-prompt.mjs` — contract field parsing
- `skills/create-spine-tasks/references/contract-template.md`
- `spine-tasks/SP-088-task-size-stall-budget/PROMPT.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/task-stall-budget.mjs`
- `src/batch/worker-host.mjs`
- `src/tasks/packet/parse-prompt.mjs`
- `src/tasks/packet/validate-prompt.mjs` (if contract schema validation needed)
- `tests/batch/contract-stall-override.test.mjs` (new)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-stall-override.test.mjs tests/batch/task-stall-budget.test.mjs` |
| fileScopeMustChange | `src/batch/task-stall-budget.mjs`, `src/tasks/packet/parse-prompt.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/contract-stall-override.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-029 stall at 120m with `extendGraceOnFileScope: false` and Size S (or missing Size)
- [ ] Trace `resolveStallConfigForTask` call chain in worker-host for real pi batches
- [ ] Review contract parse/validate for existing numeric fields

### Step 1: Parse and apply contract stall override

- [ ] Parse optional `stallTimeoutMinutes` from Contract table in PROMPT.md
- [ ] `resolveTaskStallMinutes(size, config, contract)` returns max(global, size floor, contract override)
- [ ] Wire contract into `resolveStallConfigForTask` and worker pi timeout resolver

### Step 2: Operator guidance + optional grace

- [ ] Document matrix/operator packet pattern with `stallTimeoutMinutes: 240` in operator-runbook
- [ ] Optional: per-contract `extendGraceOnFileScope` flag (or document global config toggle)

### Step 3: Testing & Verification

- [ ] Unit test: contract override beats global 120 for S-sized task
- [ ] Unit test: override aligns worker pi timeout with stall budget
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Update contract-template reference if schema extended
- [ ] Close issue #19 (`gh issue close 19`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — long operator jobs, contract stall override

**Check If Affected:**

- `skills/create-spine-tasks/references/contract-template.md` — optional stallTimeoutMinutes row

## Completion Criteria

- [ ] Contract `stallTimeoutMinutes` overrides global/size floor when set
- [ ] Worker stall loop and pi timeout share contract-aware budget
- [ ] Operator-runbook documents matrix task pattern
- [ ] Tests pass with coverage gate
- [ ] Issue #19 closed

## Git Commit Convention

- `feat(SP-314): complete Step N — description`
- `fix(SP-314): description`
- `test(SP-314): description`

## Do NOT

- Remove SP-088 size-based floors (contract is additive max)
- Set unbounded stall timeouts without explicit contract value
- Change default global `stallTimeoutMinutes` for all tasks

---

## Amendments (Added During Execution)
