# Task: SP-339 — Status JSON task progress

**Created:** 2026-06-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** `spine status --json` omits task/wave progress fields needed for automated monitoring.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #30**: add task and wave progress to `spine status --json` output for monitoring integrations.

**Required behavior:**

1. Include `succeededTasks`, `pendingTasks`, `totalTasks`, `currentWaveIndex`, `waveCount` in JSON output.
2. Document fields in operator-runbook monitoring section.
3. Regression test in status-json suite.

**Closes:** [#30](https://github.com/beettlle/pi-spine/issues/30)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #30
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `bin/spine-status.mjs`
- `src/batch/status-json.mjs`
- `tests/batch/status-json-progress.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/status-json-progress.test.mjs` |
| fileScopeMustChange | `src/batch/status-json.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/status-json-progress.test.mjs` |

## Steps

### Step 0: Preflight: audit current JSON shape

- [ ] Preflight: audit current JSON shape

### Step 1: Add progress fields

- [ ] Add progress fields

### Step 2: Tests + docs + delivery

- [ ] Tests + docs + delivery

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #30 (`gh issue close 30`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #30 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-339): complete Step N — description`
- `fix(SP-339): description`
- `test(SP-339): description`

## Do NOT

- Expand scope beyond issue #30 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
