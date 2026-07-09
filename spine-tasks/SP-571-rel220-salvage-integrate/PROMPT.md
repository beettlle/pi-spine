# Task: SP-571 — operator salvage integrate

**Created:** 2026-07-09
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Integrate salvageable lane commits with gate and conflict handling.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

**Closes:** [#158](https://github.com/beettlle/pi-spine/issues/158)

Extend salvage CLI from SP-570 with integrate execution:

```bash
spine batch salvage --batch <batchId> --lane <n> --integrate [--yes]
```

- Respect integrate gates (conflicts reported, not silently dropped)
- Handle partial lane success (some tasks failed, others succeeded)
- `--yes` for non-interactive; default confirmation prompt

## Dependencies

- **Task:** SP-570

## Context to Read First

- [`src/batch/integrate.mjs`](../../src/batch/integrate.mjs)
- [`docs/design/integrate-conflict-recovery.md`](../../docs/design/integrate-conflict-recovery.md)
- SP-570 `salvage-batch.mjs`

## File Scope

- `src/batch/salvage-batch.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/batch-salvage-integrate.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-salvage-integrate.test.mjs` |
| fileScopeMustChange | `src/batch/salvage-batch.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read SP-570 list API and #158 acceptance criteria
- [ ] Trace `spine integrate` gate checks

### Step 1: Salvage integrate module

- [ ] `integrateSalvageableLane(projectRoot, batchId, laneNumber, options)`
- [ ] Reuse merge/integrate helpers; fail on conflict with actionable error
- [ ] Skip tasks that failed contract/review

### Step 2: CLI + tests

- [ ] `--lane N --integrate` and `--yes` flags
- [ ] Integration tests with abort fixture + succeeded lane commits

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Runbook §batch abort recovery — salvage workflow
- [ ] Comment on #158
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Operator can salvage succeeded lane commits after abort without manual cherry-pick

## Git Commit Convention

- `feat(SP-571): spine batch salvage integrate (#158)`

## Do NOT

- Bypass integrate gates
- Integrate failed contract/review tasks
