# Task: SP-754 — wait: start banner + periodic progress (P1)

**Created:** 2026-09-13
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Adds stdout during the poll loop; must not change match semantics or flood logs. Interval-aligned progress only.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 0
**Problem theory:** Even with match headlines (SP-753), a multi-minute wait prints nothing until exit, so agent hosts treat the process as hung.

## Mission

Partial #286 — In human mode, print a start banner (batchId when known, `--until` set, timeout) and periodic liveness/progress lines aligned to `--interval` (or every N polls). Progress should include diagnosis/phase/task counts/elapsed when available from reconcile. Keep `--json` free of continuous chatter unless an optional documented progress object is explicitly added (default: no NDJSON progress stream).

## Dependencies

- **Task:** SP-753 (P0 headlines must land first; same `wait.mjs` hot file)

## Context to Read First

- `Parent split: SP-753 — wait human match/timeout headlines`
- `src/cli/wait.mjs` — poll loop after SP-753
- `tests/cli/wait.test.mjs`
- GitHub #286 — P1 acceptance

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

> **Coverage:** Post-integrate `release:check` owns ≥77% line coverage. Do not set `minLineCoverage` with scoped `node --test` (no parseable coverage table in stdout) — same failure mode as SP-671 / SP-753.

## Steps

### Step 0: Preflight

- [ ] Confirm SP-753 headlines present on match/timeout
- [ ] Note current `--interval` default and sleep path
- [ ] Dependencies satisfied

### Step 1: Banner + periodic progress

- [ ] Human mode: start banner once (until set, timeout, batchId when captured)
- [ ] Human mode: emit progress on an interval-aligned cadence (not every micro-sleep if that would spam)
- [ ] Progress line includes enough fields to prove liveness (diagnosis and/or phase, elapsed)
- [ ] `--json` remains quiet during the loop (terminal snapshot only) unless STATUS documents a deliberate optional schema
- [ ] Unit tests cover banner + at least one progress write before match

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
- None (SP-756 owns operator docs)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — wait interval wording

## Completion Criteria

- [ ] Human wait shows start + mid-wait progress before match
- [ ] Scoped tests pass
- [ ] Partial #286 (P1)

## Git Commit Convention

- `fix(SP-754): wait start banner and progress lines (#286)`

## Do NOT

- Remove SP-753 headlines
- Change `--until` matching
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
