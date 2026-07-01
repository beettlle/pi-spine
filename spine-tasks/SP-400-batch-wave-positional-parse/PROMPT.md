# Task: SP-400 — Batch start wave flag positional parse fix

**Created:** 2026-07-01
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** One-line-class CLI parse bug; SP-385 shipped `waveFilter` but scope string still corrupt.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #65**: `spine batch start pending --wave 0` must start only planner wave 0 tasks (not fail with `Use scope "pending" alone; do not combine with other tokens.`).

**Root cause (verified):** `parseBatchArgs` in `bin/spine-batch.mjs` builds `positional` from all non-flag tokens except subcommand. The `--wave` value (`0`) is not a flag token, so `scope` becomes `"pending 0"` instead of `"pending"`. `waveFilter` is correctly `0` but `buildPlan` receives invalid scope.

**Related:** SP-385 implemented wave filtering in engine; this task completes the CLI wiring.

**Closes:** [#65](https://github.com/beettlle/pi-spine/issues/65)

## Dependencies

None

## Context to Read First

- GitHub issue #65
- `bin/spine-batch.mjs` (`parseBatchArgs`, lines ~63–134)
- `tests/batch/batch-start-wave.test.mjs` (existing `parseBatchArgs` test does not assert `scope`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-batch.mjs`
- `tests/batch/batch-start-wave.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/batch-start-wave.test.mjs` |
| fileScopeMustChange | `spine-tasks/SP-400-batch-wave-positional-parse/STATUS.md` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/batch-start-wave.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `parseBatchArgs(["start","pending","--wave","0","--dry-run"])` yields `scope: "pending"`, `waveFilter: 0`
- [ ] Confirm current failure: `scope: "pending 0"`

### Step 1: Exclude flag values from positional scope

- [ ] Add helper to strip tokens that are values for known flags (`--wave`, `--through-wave`, `--batch`, `--reason`)
- [ ] Apply in `parseBatchArgs` before `positional.join(" ")`
- [ ] Keep `waveFilter` parsing unchanged (`parseBatchStartWaveFilter`)

### Step 2: Testing & Verification

- [ ] Extend `batch-start-wave.test.mjs`: assert `scope === "pending"` for `pending --wave 0`
- [ ] Add integration test: `startBatch({ scope: "pending", waveFilter: 0, dryRun: true })` succeeds on multi-wave fixture
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Close issue #65
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (wave start examples — only if still inaccurate)

## Completion Criteria

- [ ] All steps complete
- [ ] `spine batch start pending --wave 0 --dry-run` works on repo with pending tasks
- [ ] Issue #65 closed

## Git Commit Convention

- `feat(SP-400): complete Step N — description`
- `fix(SP-400): description`
- `test(SP-400): description`

## Do NOT

- Change `parseBatchStartWaveFilter` semantics
- Re-open or modify SP-385 delivery beyond this parse fix

---

## Amendments (Added During Execution)
