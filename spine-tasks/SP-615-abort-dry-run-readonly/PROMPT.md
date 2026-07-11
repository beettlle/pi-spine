# Task: SP-615 — Abort dry-run readonly

**Created:** 2026-07-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Make `spine batch abort --dry-run` truly read-only; today CLI may ignore dry-run and archive.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #196 — `spine batch abort --dry-run` must not archive the live batch, journal `batch.aborted`, or clear batch state. Without `--dry-run`, abort behavior stays unchanged. Completes the three #196 asks after SP-613 and SP-614.

**Source:** [`docs/PRD-v2.3.2-state-drift-recovery-handoff.md`](../../docs/PRD-v2.3.2-state-drift-recovery-handoff.md) §6 FR-REL232-03

## Dependencies

- **Task:** SP-613 (detached drift recovery landed)
- **Task:** SP-614 (salvage lane commits landed)

## Context to Read First

- [`bin/spine-batch.mjs`](../../bin/spine-batch.mjs) — abort subcommand + `parsed.dryRun`
- [`src/batch/abort.mjs`](../../src/batch/abort.mjs) — `abortBatch`
- [`tests/batch/abort.test.mjs`](../../tests/batch/abort.test.mjs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-batch.mjs`
- `src/batch/abort.mjs`
- `tests/batch/abort.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/abort.test.mjs` |
| fileScopeMustChange | `bin/spine-batch.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm abort path ignores `--dry-run` (or mutates despite flag)
- [ ] Define dry-run output shape (preview reason/archive target; no mutation)

### Step 1: Honor abort --dry-run

- [ ] Pass dryRun into abort path; skip archive/journal/state clear when true
- [ ] Real abort (no dry-run) unchanged
- [ ] CLI help/usage reflects read-only dry-run

### Step 2: Testing & Verification

- [ ] Regression: dry-run leaves live batch unarchived; mutating abort still works
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — abort dry-run note if present

## Completion Criteria

- [ ] `abort --dry-run` is read-only
- [ ] Mutating abort still works
- [ ] Issue #196 closable after land (all three asks done)

## Do NOT

- Change salvage or resume recovery logic (SP-613 / SP-614)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-615): abort --dry-run does not mutate batch state`
