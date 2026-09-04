# pi-spine operator handoff

**Generated at:** <TIMESTAMP>
**Batch ID:** 20260601T140000

## Situation
**paused** — Batch 20260601T140000 is paused with 2 tasks pending — use spine batch resume (multi-task)

## Background
- Batch: 20260601T140000
- Phase: paused (macro: paused)
- Progress: 2/4 tasks succeeded, 2 pending

## Assessment
Batch was paused by an operator or gate with 2 task(s) pending — resume continues from journal state

## Recommendation
- spine batch resume
- spine batch resume --force
- spine status --diagnose

## Pending tasks
- TP-003 (lane —, pending)
- TP-004 (lane —, pending)

## Lane summary
| Lane | Status | Tasks |
|------|--------|-------|
| — | pending | TP-003 |
| — | pending | TP-004 |

## Journal tail
- <TIMESTAMP> batch.paused
- <TIMESTAMP> task.step_completed TP-003

## Restore
1. spine batch resume
2. spine batch resume --force
3. spine status --diagnose
