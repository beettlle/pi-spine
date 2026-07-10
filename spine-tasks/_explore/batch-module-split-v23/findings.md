# Explore: batch-module-split-v23

**Date:** 2026-07-10
**Status:** complete

## Summary

Sixteen `src/batch/` modules are grandfathered in `PHASE23_GRANDFATHERED_OVER_500` (`bin/spine-cli/verify.mjs`). Issue #117 listed nine modules; v2.2.0 work added seven more (including `salvage-batch.mjs`). Prior partial extract: `detached-spawn.mjs` already exists from detached-start work. Decomposition: one M-task per source module, Strangler Fig re-exports, remove grandfather entry per task, final task empties the array.

## Codebase areas

- `bin/spine-cli/verify.mjs` — `PHASE23_GRANDFATHERED_OVER_500`, `batch-loc-policy` check
- `src/batch/reconcile.mjs` (1715 LOC) — classification, git inspection, diagnosis; top importer target
- `src/batch/review.mjs` (1224 LOC) — review level parsing, artifact discovery, spawn
- `src/batch/detached-start.mjs` (908 LOC) + `detached-spawn.mjs` — spawn/wait vs diagnostics
- `src/batch/worker-host.mjs` (846 LOC) — spawn, heartbeat, stall detection
- `src/batch/sequence.mjs` (791 LOC) — sequence plan + run (release profile integration)
- `src/batch/lane-dirty-check.mjs` (750 LOC) — worktree dirty validation
- `src/batch/journal-rebuild.mjs` (740 LOC) — structural rebuild + drift reconcile
- `src/batch/state.mjs` (729 LOC) — batch-state I/O, guards, PID
- `src/batch/contract-verify.mjs` (714 LOC) — contract parse + exec
- `src/batch/salvage-batch.mjs` (691 LOC) — salvage list + integrate (v2.2.0)
- `src/batch/attached-runner.mjs` (647 LOC) — attached promote/reconcile paths
- `src/batch/resume-multi-lanes.mjs` (583 LOC) — per-lane queue wiring
- `src/batch/engine.mjs` (556 LOC) — nested-spawn guard candidate for `batch-guards.mjs`
- `src/batch/resume.mjs` (506 LOC) — borderline; monitor after other splits
- `src/batch/integrate.mjs` (506 LOC) — three identical `tryRestoreBranch` blocks (#116)
- `src/batch/lifecycle.mjs` (498 LOC) — under limit; monitor only
- `tests/batch/*.test.mjs` — regression per module (scoped `node --test`)

## Risks

- **Import cycles** — split modules must not create cycles; run SP-432 arch guard after each wave
- **reconcile.mjs size (1715)** — largest module; may need careful step boundaries within one M task
- **state.mjs coupling** — imported by reconcile, attached-runner, engine-lanes; split state after reconcile or use re-export shim
- **detached-spawn.mjs exists** — detached-start split must not duplicate; extract diagnostics only
- **Cumulative contract diff** — parallel splits use disjoint file scopes; serialized lane tasks share cumulative diff

## Suggested file scopes

| Task | Must change | New modules |
|------|-------------|-------------|
| SP-578 | `reconcile.mjs`, `verify.mjs` | `reconcile-classify.mjs`, `reconcile-diagnosis.mjs` |
| SP-579 | `review.mjs`, `verify.mjs` | `review-artifacts.mjs`, `review-spawn.mjs` |
| SP-580 | `detached-start.mjs`, `verify.mjs` | `detached-diagnostics.mjs` |
| SP-581 | `worker-host.mjs`, `verify.mjs` | `worker-spawn.mjs`, `worker-heartbeat.mjs` |
| SP-582 | `sequence.mjs`, `verify.mjs` | `sequence-plan.mjs`, `sequence-run.mjs` |
| SP-583 | `lane-dirty-check.mjs`, `verify.mjs` | `lane-dirty-check-git.mjs` (or equivalent) |
| SP-584 | `journal-rebuild.mjs`, `verify.mjs` | `journal-rebuild-structural.mjs`, `journal-rebuild-drift.mjs` |
| SP-585 | `contract-verify.mjs`, `verify.mjs` | `contract-parse.mjs`, `contract-exec.mjs` |
| SP-586 | `attached-runner.mjs`, `verify.mjs` | `attached-runner-promote.mjs`, `attached-runner-reconcile.mjs` |
| SP-587 | `state.mjs`, `verify.mjs` | `state-io.mjs`, `state-guards.mjs` |
| SP-588 | `engine.mjs`, `verify.mjs` | `batch-guards.mjs` |
| SP-589 | `integrate.mjs`, `verify.mjs` | helper in `integrate-git.mjs` or inline extract |
| SP-590 | `resume-multi-lanes.mjs`, `verify.mjs` | extract if still >500 |
| SP-591 | `salvage-batch.mjs`, `verify.mjs` | `salvage-batch-list.mjs`, `salvage-batch-integrate.mjs` |
| SP-592 | `resume.mjs`, `lifecycle.mjs`, `verify.mjs` | split only if still >500 |
| SP-593 | `verify.mjs` | empty grandfather array |

## Open questions

- None — split-only scope confirmed in clarify.md; operator defers #43, #120–127, #135, #160.

## Verification (SP-577, 2026-07-10)

LOC counts re-checked with `wc -l` — no drift from explore snapshot above.

| Module | LOC (verified) | In `PHASE23_GRANDFATHERED_OVER_500` |
|--------|----------------|--------------------------------------|
| reconcile.mjs | 1715 | yes |
| review.mjs | 1224 | yes |
| detached-start.mjs | 908 | yes |
| detached-spawn.mjs | 82 | no (prior extract) |
| worker-host.mjs | 846 | yes |
| sequence.mjs | 791 | yes |
| lane-dirty-check.mjs | 750 | yes |
| journal-rebuild.mjs | 740 | yes |
| state.mjs | 729 | yes |
| contract-verify.mjs | 714 | yes |
| salvage-batch.mjs | 691 | yes |
| attached-runner.mjs | 647 | yes |
| resume-multi-lanes.mjs | 583 | yes |
| engine.mjs | 556 | yes |
| resume.mjs | 506 | yes |
| integrate.mjs | 506 | yes |
| lifecycle.mjs | 498 | yes (borderline; monitor SP-592) |

**Grandfather list:** 16 entries in `bin/spine-cli/verify.mjs` — matches summary.

**Handoff §6 cross-check (SP-574–595):** Task IDs, slugs, sizes, and split targets align with suggested file scopes table. Extended second-half tasks (SP-596–605) documented in `CONTEXT.md` Phase 65 table; not in handoff §6 decomposition.
