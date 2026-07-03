# Task: SP-450 — Pi extension conflict doctor and worker guard

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Worker spawn reliability for monorepo dev; doctor + runner guard.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When npm-installed `pi-web-access` and a local dev checkout both register the same tool names (`web_search`, `fetch_content`, `get_search_content`), pi workers fail to spawn. Add `spine doctor` warning and worker-runner mitigation (e.g. `pi -ne` for batch workers or extension path dedup). Closes [#104](https://github.com/beettlle/pi-spine/issues/104).

## Dependencies

- **None**

## Context to Read First

- GitHub issue [#104](https://github.com/beettlle/pi-spine/issues/104)
- `bin/spine-worker-runner.mjs`
- `src/doctor/*.mjs` (or doctor entry)
- Worker output: `.spine/runtime/*/lanes/*/worker-output-SP-435.log`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-worker-runner.mjs`
- `src/doctor/checks.mjs`
- `src/doctor/index.mjs`
- `tests/doctor/extension-conflict.test.mjs`
- `tests/agents/worker-runner.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/extension-conflict.test.mjs tests/agents/worker-runner.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read issue #104 worker-output excerpt
- [ ] Inspect how pi resolves extension paths in worker spawn

### Step 1: Doctor warning

- [ ] Detect duplicate tool registration risk (npm pi-web-access + local checkout on path)
- [ ] `spine doctor` emits actionable warning with fix (`pi -ne`, unlink npm package, or PATH hygiene)

### Step 2: Worker runner guard

- [ ] Batch workers use safe extension mode (`-ne` or isolated extension config) so spawn cannot fail on conflict
- [ ] Log clear error in worker-output when conflict still detected

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update operator-runbook pi extension / monorepo dev section
- [ ] Close GitHub issue #104 (`gh issue close 104`)
- [ ] Update `spine-tasks/CONTEXT.md`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — pi-web-access extension conflicts

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Issue #104 closed

## Git Commit Convention

- `feat(SP-450): complete Step N — description`
- `fix(SP-450): description`

## Do NOT

- Modify pi-web-access package itself (pi-spine consumer guard only)
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
