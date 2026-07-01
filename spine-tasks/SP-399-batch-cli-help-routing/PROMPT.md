# Task: SP-399 — Batch CLI --help routing

**Created:** 2026-07-01
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CLI routing fix; prevents accidental batch start when operator requests help.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #64**: `spine batch start --help` (and related batch subcommand help invocations) must print usage and exit 0 — never start a batch.

**Root cause (verified):** `bin/spine.mjs` routes `batch` to `handleBatch` without inspecting `--help`. `parseBatchArgs` in `bin/spine-batch.mjs` treats `--help` as absent; `scope` defaults to `"all"` and `start` runs.

**Closes:** [#64](https://github.com/beettlle/pi-spine/issues/64)

## Dependencies

None

## Context to Read First

- GitHub issue #64
- `bin/spine.mjs` (`case "batch"`)
- `bin/spine-batch.mjs` (`parseBatchArgs`, `runSpineBatch`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-batch.mjs`
- `bin/spine.mjs`
- `tests/cli/batch-help.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/batch-help.test.mjs` |
| fileScopeMustChange | `bin/spine-batch.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/cli/batch-help.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce: `node bin/spine.mjs batch start --help` must not create `.spine/batch-state.json` activity
- [ ] Inventory help patterns: `batch --help`, `batch start --help`, `batch help`, `batch start -h`

### Step 1: Help routing

- [ ] Add `printBatchHelp()` (or reuse usage string from `runSpineBatch` error path) in `bin/spine-batch.mjs`
- [ ] Early-exit in `runSpineBatch` when `args` contains `--help`, `-h`, or lone `help` token after subcommand
- [ ] Optionally guard in `bin/spine.mjs` before `handleBatch` for top-level `batch help`

### Step 2: Testing & Verification

- [ ] Add `tests/cli/batch-help.test.mjs`: spawn CLI, assert stdout contains Usage, exit 0, no batch started
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Close issue #64
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` (only if batch help examples are wrong)

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Issue #64 closed

## Git Commit Convention

- `feat(SP-399): complete Step N — description`
- `fix(SP-399): description`
- `test(SP-399): description`

## Do NOT

- Change default batch start behavior for non-help invocations
- Expand scope to other subcommands beyond `batch` (separate issues)

---

## Amendments (Added During Execution)
