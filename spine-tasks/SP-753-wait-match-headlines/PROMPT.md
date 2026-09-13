# Task: SP-753 — wait: human match/timeout/supersede headlines (P0)

**Created:** 2026-09-13
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** CLI UX only in `src/cli/wait.mjs`; no batch state machine changes. Operators and agent outer loops gain stdout on terminal wait outcomes.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** Human-mode `runSpineWait` returns exit 0/1 on match/timeout without writing stdout; only `--json` emits a snapshot. Supersede already prints stderr. Silent success makes long waits look hung.

## Mission

Partial #286 — In human (non-`--json`) mode, print one clear terminal line when `spine wait` matches, times out, or is interrupted. Do not add the start banner or periodic progress yet (SP-754). Keep `--json` behavior (single snapshot on match/timeout) unchanged unless tests require a documented companion line.

## Dependencies

- **None**

## Context to Read First

- `src/cli/wait.mjs` — `runSpineWait` match/timeout/supersede branches
- `tests/cli/wait.test.mjs` — existing wait coverage patterns
- GitHub #286 — P0 acceptance (match/timeout/supersede headlines)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/cli/wait.mjs`
- `tests/cli/wait.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/cli/wait.test.mjs` |
| fileScopeMustChange | `src/cli/wait.mjs`, `tests/cli/wait.test.mjs` |

> **Coverage:** Post-integrate `release:check` owns ≥77% line coverage. Do not set `minLineCoverage` with scoped `node --test` (no parseable coverage table in stdout) — same failure mode as SP-671.

## Steps

### Step 0: Preflight

- [ ] Confirm human-mode match path returns without `writeStdout` today
- [ ] Confirm supersede already has a human headline on stderr
- [ ] Dependencies satisfied

### Step 1: Human terminal headlines

- [ ] On match (non-json): write one stdout line including diagnosis, scoped batchId, and elapsed when available
- [ ] On timeout (non-json): write one stdout or stderr line distinguishing timeout from match
- [ ] On interrupt (SIGINT path): write one human line when not json (if reachable in tests)
- [ ] Preserve `--json` single-snapshot stdout on match/timeout
- [ ] Unit tests: stub reconcile that matches / times out; assert `writeStdout`/`writeStderr` called in human mode

**Artifacts:**
- `src/cli/wait.mjs` (modified)
- `tests/cli/wait.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (docs deferred to SP-756)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — wait section still accurate after headlines land

## Completion Criteria

- [ ] Human-mode match and timeout each emit ≥1 line
- [ ] Scoped wait tests pass
- [ ] Partial #286 (P0 only)

## Git Commit Convention

- `fix(SP-753): wait human match/timeout headlines (#286)`

## Do NOT

- Add start banner or periodic progress (SP-754)
- Change diagnosis matching semantics
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
