# Task: SP-620 — Reconstruct batch state from batch-meta

**Created:** 2026-07-11
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Force-resume reconstruct can resume the wrong wave if incorrect — medium blast radius and reversibility risk.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #126 — On `spine batch resume --force` after abort (or when live `batch-state.json` is missing/corrupt), rebuild usable batch state from `.spine/runtime/{batchId}/batch-meta.json` plus surviving runtime artifacts so operators avoid manual git surgery.

**Fail-closed:** Prefer a clear error over silently resuming the wrong wave.

**Source:** [`docs/PRD-v2.4.0-recovery-batch-meta-handoff.md`](../../docs/PRD-v2.4.0-recovery-batch-meta-handoff.md) §6 FR-REL240-04

**Upstream reference:** Taskplane `reconstructBatchStateFromRuntime` (issue #126).

## Dependencies

- **Task:** SP-619 (persist path + schema must exist)

## Context to Read First

- [`spine-tasks/SP-619-batch-meta-persist/PROMPT.md`](../SP-619-batch-meta-persist/PROMPT.md)
- [`src/batch/resume.mjs`](../../src/batch/resume.mjs)
- [`src/batch/state-io.mjs`](../../src/batch/state-io.mjs)
- [`src/batch/batch-meta.mjs`](../../src/batch/batch-meta.mjs) — after SP-619
- [`tests/batch/journal-rebuild-incidents.test.mjs`](../../tests/batch/journal-rebuild-incidents.test.mjs)
- [`tests/batch/resume-orphan-recovery.test.mjs`](../../tests/batch/resume-orphan-recovery.test.mjs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/batch-meta.mjs`
- `src/batch/resume.mjs`
- `src/batch/resume-multi-validate.mjs`
- `src/batch/state-io.mjs`
- `tests/batch/batch-meta-reconstruct.test.mjs`
- `tests/batch/journal-rebuild-incidents.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-meta-reconstruct.test.mjs` |
| fileScopeMustChange | `tests/batch/batch-meta-reconstruct.test.mjs`, `src/batch/resume.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-619 landed (persist helper + schema)
- [ ] Trace `resume --force` when state file missing vs corrupt parse

### Step 1: Reconstruct + wire force-resume

- [ ] Implement `reconstructBatchStateFromRuntime` (or equivalent) from batch-meta + surviving artifacts
- [ ] Wire into `resume --force` path when state missing/corrupt
- [ ] Fail closed with actionable error if meta missing or ambiguous

### Step 2: Testing & Verification

- [ ] Add incident-style tests: missing/corrupt `batch-state.json` + present meta → reconstruct succeeds; wrong/missing meta → clear failure
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-621

## Completion Criteria

- [ ] Force-resume reconstructs from batch-meta when state is missing/corrupt
- [ ] Wrong-wave / missing-meta cases fail closed
- [ ] Regression tests cover the #126 limbo scenario
- [ ] Issue #126 ready to close after integrate

## Do NOT

- Change persist-at-start contract beyond reconstruct needs (SP-619 owns write)
- Expand into mailbox (#127) or parallel wave strategies (#124)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-620): reconstruct batch state from batch-meta on force-resume`

## Amendments

- Pre-landed redirect (2026-07-11): dropped `src/batch/batch-meta.mjs` from `fileScopeMustChange` — already landed by SP-619. Delivery proof is reconstruct test + `resume.mjs` wiring.
