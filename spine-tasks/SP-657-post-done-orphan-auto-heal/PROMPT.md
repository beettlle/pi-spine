# Task: SP-657 — Post-DONE orphan auto-heal

**Created:** 2026-07-13
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Reconcile/engine land path must heal `.DONE` + dead worker/engine before `merge_blocked`; touches orphan + resume promotion.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Partial:** [#205](https://github.com/beettlle/pi-spine/issues/205)

In batch `20260713T171709`, SP-649 completed Step 3 with lane `.DONE` present, then sat ~4h until operator recover marked `worker_orphaned` and `batch.merge_blocked` with `failed=[SP-649]`. `skippedDoneOnDisk` heal already works on **manual** retry — product must auto-heal when `.DONE` exists and worker/engine are dead **before** classifying merge_blocked / failed.

Heal toward terminal success / skip-done path used by resume-multi (`skippedDoneOnDisk`) so a post-DONE orphan does not block wave merge when lane evidence is complete.

**Source:** [`docs/release/post-mortem-v2.7.0-batch-20260713T171709.md`](../../docs/release/post-mortem-v2.7.0-batch-20260713T171709.md) §7 P0.2, §F3

## Dependencies

- **None**

## Context to Read First

- GitHub issue #205 (limbo timeline)
- `src/batch/resume-multi-lanes.mjs` (`skippedDoneOnDisk`)
- `src/batch/journal-rebuild-drift.mjs` (done-on-disk gates)
- `src/batch/reconcile-orphan.mjs`, `src/batch/orphan-detect.mjs`
- `src/batch/engine-lanes.mjs` / `src/batch/lifecycle.mjs` (merge_blocked)
- `tests/batch/resume-skip-succeeded.test.mjs`, `tests/batch/orphan-retry-limbo.test.mjs`
- Post-mortem §F3

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/reconcile-orphan.mjs`
- `src/batch/orphan-detect.mjs`
- `src/batch/resume-multi-lanes.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/post-done-orphan-heal.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/post-done-orphan-heal.test.mjs tests/batch/resume-skip-succeeded.test.mjs` |
| fileScopeMustChange | `src/batch/reconcile-orphan.mjs`, `tests/batch/post-done-orphan-heal.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce classification: `.DONE` present + dead worker/engine → today orphan → merge_blocked
- [ ] Inventory where `skippedDoneOnDisk` is set on resume vs reconcile

### Step 1: Auto-heal before merge_blocked

- [ ] When lane `.DONE` (+ contract/terminal success evidence as already required elsewhere) and worker/engine dead, promote/heal via existing skip-done path **before** `batch.merge_blocked` with that task in `failed`
- [ ] Do not invent a second heal mechanism — reuse `skippedDoneOnDisk` / resume-multi promotion semantics
- [ ] Add fixture covering post-DONE orphan → healed success (no failed merge_blocked for that task)

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Coverage gate (code change): `npm run coverage:check` (≥77% line coverage)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Do **not** close #205 (SP-658 closes)

## Documentation Requirements

**Must Update:**
- None (narrative in SP-661)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-661

## Completion Criteria

- [ ] Post-DONE + dead worker/engine does not put that task in `merge_blocked` failed set when heal evidence is present
- [ ] Reuses skip-done / `skippedDoneOnDisk` semantics
- [ ] Scoped tests green

## Do NOT

- Change diagnose headline ordering (SP-658)
- Change dirty-check markers (SP-656/659)
- Hand-edit `.spine/batch-state.json` or `.spine/runtime/**`
- Modify `.spine/` config, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Close #205 from this packet

## Git Commit Convention

- `fix(SP-657): auto-heal post-DONE orphan before merge_blocked (#205)`
