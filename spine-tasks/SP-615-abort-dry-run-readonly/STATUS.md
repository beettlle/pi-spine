# SP-615: Abort dry-run readonly — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-11
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Confirm dry-run ignored / mutates
- [x] Define dry-run preview output

### Step 1: Honor abort --dry-run

**Status:** ✅ Complete

- [x] dryRun skips archive/journal clear
- [x] Mutating abort unchanged
- [x] CLI help updated if needed

### Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] Regression tests
- [x] Contract testCommand
- [x] Full suite + coverage gate

### Step 3: Documentation & Delivery

**Status:** ✅ Complete

- [x] `.DONE` created

## Notes

### Step 0 findings / plan

- **Bug:** `bin/spine-batch.mjs` parses `--dry-run` into `parsed.dryRun` but abort path calls `abortBatch({...})` without `dryRun`. `abortBatch` always archives, journals `batch.aborted`, and clears active state.
- **Dry-run output shape:** After validating active batch, return `ok: true`, `dryRun: true`, `batchId`, `hard`, `reason`, preview `archivePath` (would-be path via `archiveBatchStatePath`), headline like `Would abort and archive batch <id>`, `suggestedCommand` pointing at mutating abort. Skip: abort-signal write, worker kill, archive write, journal, history, worktree cleanup, clear active state.
- **Mutating abort:** unchanged when `dryRun` is false/absent.
- **Help:** clarify abort `--dry-run` is read-only in usage string if needed.
- **Tests:** dry-run leaves active state + journal intact; non-dry-run still archives.
- **Docs:** runbook has no abort dry-run note; File Scope excludes runbook; Must Update: none.
- **Impact:** `abortBatch` upstream risk LOW.

### Step 1 implementation

- `abortBatch` accepts `dryRun`; early return after validation with preview fields.
- CLI passes `dryRun: parsed.dryRun`.
- Help line documents read-only abort dry-run.
- `formatLifecycleHuman` labels dry-run archive as "Would archive".
- Regression tests added in `tests/batch/abort.test.mjs`.

### Step 2 verification

- Contract: `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/abort.test.mjs` — 8 pass.
- Full suite: `env -u SPINE_IS_WORKER … SPINE_WORKER_STUB=1 npm test` — 1985 pass, 0 fail (unset SPINE_IS_WORKER so nested startBatch tests are not blocked by worker guard).
- Coverage: `npm run coverage:check` — line coverage 88.89% (threshold 77%).

## Discoveries

| Finding | Action |
|---------|--------|
| CLI parses dryRun but never passes it to abortBatch | Pass dryRun; short-circuit mutations in abortBatch |
| Full suite under SPINE_IS_WORKER=1 fails nested startBatch | Unset SPINE_IS_WORKER for suite/coverage in worker lane |
