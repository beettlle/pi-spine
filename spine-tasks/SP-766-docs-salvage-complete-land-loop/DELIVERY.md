# SP-766 — Delivery: salvage→complete land loop documentation (#291, #292)

**Delivered:** 2026-09-22
**Size:** S — documentation only; no runtime code changed (`detect_changes`: 0 symbols, 0 processes, risk low).

## What landed

### `docs/adoption/operator-runbook.md`

1. **Diagnosis quick map:** new `pending_lane_land` row — lane work complete on disk (`.DONE`, lane commits) but not on base; includes the post-DONE plan-review spawn-failure classification (#291): `plan_review_spawn_failed` / `plan_review_timeout` after done evidence maps to `pending_lane_land` instead of `needs_retry`. Next step: salvage land loop, **do not retry the worker**.
2. **New subsection "Salvage → complete land loop after post-DONE plan-review spawn failure (#291, #292)":**
   - Symptom: worker wrote `.DONE` and committed lane work, then engine plan review failed to spawn or timed out.
   - `spine status --diagnose` → `pending_lane_land` (SP-762 classification), not `needs_retry`.
   - Recovery sequence: `status --diagnose` → `salvage --batch <id> --dry-run` → `salvage --lane <n> --integrate --yes` (gate approve if pending) → `spine batch complete`.
   - `batch complete` after salvage integrate (#292 / SP-763): failed-task gate healed — salvaged tasks promoted to succeeded with reconciled `task.completed` journal event (`reconcileReason: salvage_integrated`); **`dismiss --force` is no longer part of this path**.
   - Limits: heal touches only the salvage set; non-salvageable failures (contract/review, evidence-less worker deaths) keep blocking complete. `batch.salvage_heal_failed` = merge landed, heal did not.
3. **"Typical workflow" (abort-salvage section):** now ends with `spine batch complete` to finalize when every remaining failure was salvageable (#292), cross-linked to the new subsection.

### `docs/QUICK-REFERENCE.md`

1. Diagnosis taxonomy: added `pending_lane_land` row.
2. Batch Completion block: salvage → complete pairing ("complete normally — no dismiss --force", #292).
3. Troubleshooting Common Issues: recovery row — salvage, don't retry (#291); `--integrate --yes` → `batch complete`, no `dismiss --force` (#292).

## #287 note decision

Not added, per PROMPT condition ("only if salvage multi-lane guidance is still wrong after SP-761"): SP-761 (`7a113787`) already preserves task `laneNumber` on journal rebuild after DirtyWorktree retry, and runbook salvage multi-lane guidance makes no incorrect laneNumber claims.

## Verification

| Check | Result |
|-------|--------|
| Contract `testCommand` | `true` (docs-only) |
| Spot-check: CLI usage strings | `spine batch salvage --batch <batchId> --dry-run` / `--lane <n> --integrate [--yes]` match `bin/spine-batch.mjs` usage output |
| Spot-check: journal/event strings | `batch.salvage_heal_failed`, `reconcileReason: salvage_integrated` match `src/batch/salvage-batch-integrate-heal.mjs` |
| Spot-check: `pending_lane_land` diagnosis | present in `diagnosis-suggested-command.mjs` / `diagnosis-alternatives.mjs` |
| `npm test` | 2651/2651 pass, 0 fail (exit 0) with `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` unset; first in-worker run failed 43 nested-spawn tests solely due to the worker-session `SPINE_IS_WORKER=1` guard (SP-482) — environmental, not from these changes |
| `detect_changes` | 0 changed symbols / 0 affected processes, risk low — `src/**`, `bin/**` untouched (contract `fileScopeMustNotChange`) |

## Commits

- `cec2a1ec` feat(SP-766): complete Step 0 — preflight, dependencies verified, #287 note skipped
- `58033831` docs(SP-766): salvage-to-complete land loop after post-DONE review fail (#291 #292)
- `99d1f13f` feat(SP-766): complete Step 2 — contract testCommand true, npm test 2651 pass / 0 fail
