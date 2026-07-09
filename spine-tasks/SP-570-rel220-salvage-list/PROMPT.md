# Task: SP-570 — operator salvage list CLI

**Created:** 2026-07-09
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** New CLI surface listing salvageable lane commits after abort.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

**Partial:** [#158](https://github.com/beettlle/pi-spine/issues/158)

Add `spine batch salvage` list mode for operators after abort/dismiss:

```bash
spine batch salvage --batch <batchId> --dry-run
```

List lanes with succeeded tasks (journal terminal success + lane commit exists) showing diff summary vs `main`. Read-only — no integrate in this task (SP-571).

Reuse journal + reconcile helpers; do not duplicate monitoring logic ([#43](https://github.com/beettlle/pi-spine/issues/43) deferred).

## Dependencies

- **Task:** SP-567

## Context to Read First

- [`docs/PRD-v2.2.0-backlog-drain-handoff.md`](../../docs/PRD-v2.2.0-backlog-drain-handoff.md) §FR-REL220-03
- [`src/batch/reconcile.mjs`](../../src/batch/reconcile.mjs)
- [`src/batch/integrate.mjs`](../../src/batch/integrate.mjs) — read only

## File Scope

- `src/batch/salvage-batch.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/batch-salvage-list.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-salvage-list.test.mjs` |
| fileScopeMustChange | `src/batch/salvage-batch.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #158 acceptance criteria
- [ ] Review v1.4.0 manual salvage post-mortem in issue body

### Step 1: Salvage list module

- [ ] `listSalvageableLanes(projectRoot, batchId)` — journal + git inspection
- [ ] Exclude tasks that failed contract/review
- [ ] `--dry-run` JSON/text output with per-lane diff stat

### Step 2: CLI wiring

- [ ] `spine batch salvage --batch <id> --dry-run` in `bin/spine-batch.mjs`
- [ ] Exit non-zero when batch journal missing

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Operator can list salvageable lanes without manual worktree inspection

## Git Commit Convention

- `feat(SP-570): spine batch salvage dry-run list (#158)`

## Do NOT

- Integrate lanes in this task (SP-571)
- Integrate tasks that failed contract/review
