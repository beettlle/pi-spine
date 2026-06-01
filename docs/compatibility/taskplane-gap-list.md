# Taskplane compatibility gap list

Tracked gaps discovered during pi-spine dogfooding. Each gap maps to pi-spine requirements in `pi-spine-PRD.md` §18.8.

**Last updated:** 2026-05-31  
**Source incident:** [`../incidents/20260531-phase0-taskplane-batch.md`](../incidents/20260531-phase0-taskplane-batch.md)

| ID | Taskplane behavior | pi-spine requirement | Status |
|----|---------------------|----------------------|--------|
| GAP-RETRY-01 | `orch_retry_task` resets task record but not segment frontier | §18.5 atomic retry | Open — pi-spine Phase 3 |
| GAP-ABORT-01 | Abort deletes `.pi/batch-state.json` without guaranteed segment archive | §18.6 archive-first abort | Open — pi-spine Phase 3 |
| GAP-STALL-01 | Stall kill on tool-call silence only | §18.4 progress-aware stall | Open — pi-spine Phase 3 |
| GAP-MERGE-01 | Force-resume can merge succeeded lanes while failed task pending | §17.4 mixed-outcome policy | Open — pi-spine Phase 3 |
| GAP-POST-01 | Supervisor summary claims batch "ran smoothly" with failures | NFR-OBS-03 | Open — pi-spine Phase 4 |
| GAP-REV-01 | Plan review fail-open when review tool errors at level > 0 | FR-REV-06 | Open — pi-spine Phase 4 |
| GAP-PREFLIGHT-01 | No batch preflight before `/orch all` | FR-BATCH-11, §23.1 | Open — pi-spine Phase 0 |

## Verification

When pi-spine Phase 6 runs, add regression tests that reproduce each gap against Taskplane (optional baseline) and assert pi-spine does not regress.
