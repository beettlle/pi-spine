# Phase 6 dogfood report — compatibility validation

**Date:** 2026-06-02  
**Commit:** `ce653ea08a2e7b62c76113a05214217e8aadf609` (TP-029 worktree; update on merge)  
**Test command:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`  
**Test count:** 196 (baseline 181 + 15 Phase 6 tests)

## Scope

Phase 6 closes PRD §23 compatibility validation:

- Incident regression matrix **I-01–I-10** → `tests/compat/incidents.test.mjs`
- PRD §20.2 ABC integration fixture → `tests/batch/integration-abc.test.mjs`
- Progress-aware stall + FR-WORK-10 file-scope mtime → `tests/batch/heartbeat.test.mjs`, `src/batch/heartbeat.mjs`
- Gap list **GAP-STALL-01** closed

## Incident coverage matrix

| ID | Test | Result |
|----|------|--------|
| I-01 | `I-01 progress signals extend stall deadline past hard timeout` | pass |
| I-02 | `I-02 spine batch retry resets task and segment with pendingSegments > 0` | pass |
| I-03 | `I-03 spine state validate rejects corrupt batch-state` | pass |
| I-04 | `I-04 spine batch abort archives batch-state before clearing active file` | pass |
| I-05 | `I-05 wave merge blocked on failed/pending tasks; force-merge override exists` | pass |
| I-06 | `I-06 retry refused while batch phase is executing or merging` | pass |
| I-07 | `I-07 stall logic uses STATUS, lane commit, and file-scope mtime signals` | pass |
| I-08 | `I-08 post-mortem does not claim success when failures exist` | pass |
| I-09 | `I-09 CONTEXT documents serial bootstrap and preflight execution policy` | pass |
| I-10 | `I-10 runStepReview fail-closed when review tool unavailable at level > 0` | pass |

## PRD §20.2 ABC integration

| Test | Result |
|------|--------|
| `PRD §20.2 planner yields wave0 {A,C} and wave1 {B}` | pass |
| `PRD §20.2 two-lane stub batch completes ABC waves` | pass |
| `PRD §20.2 mixed-outcome blocks merge; retry and resume complete wave B` | pass |

## Manual validation checklist (optional)

Run with `SPINE_WORKER_STUB=0` and `pi` on PATH when exercising real workers:

- [ ] `spine preflight` on clean repo
- [ ] `spine plan pending --json`
- [ ] `spine batch start <scope>` (stub or real pi)
- [ ] `spine status --diagnose`
- [ ] `spine gate status` → `spine gate approve`
- [ ] `spine integrate` → `spine batch complete`
- [ ] Dashboard: `spine dashboard` or `/spine-dashboard`

## Known deferrals for v1.0 publish (TP-030+)

- `spine migrate-from-taskplane`
- `spine init --preset taskplane-compat`
- npm publish / pi.dev listing
- Worker MCP tools (`spine_report_progress`)
- `/spine-settings`, `/spine-deps` slash stubs

## Sign-off

**Phase 6 complete — ready for publish task (TP-030).**
