# Consumer pilot sign-off — Tier 3

Fill this report after completing **Tier 3** adoption on a real consumer repository: stub batch, real-pi batch(es), full land loop, and at least one recovery path exercised. Closes [FR-REL-07](../PRD-v2.1-reliability-handoff.md) (Phase 22).

**When to file:** After [bootstrap-checklist.md](./bootstrap-checklist.md) Tier 1–2 are green and you are ready to sign off daily-operator use per [real-project-readiness.md](./real-project-readiness.md).

**Related:** [operator-runbook.md](./operator-runbook.md) (attached-first, land loop), [real-pi-e2e.md](./real-pi-e2e.md) (fixture evidence format), [local-install.md](./local-install.md) (install path).

**Phase note (SP-215):** This file is the **stub-phase skeleton** with stub-batch evidence. Real-pi batch, land loop, recovery, and sign-off are **SP-233**.

---

**Date:** 2026-06-12  
**Operator:** pi-spine worker (SP-215)  
**Consumer repo:** Adoption fixture layout (`tests/fixtures/adoption-repo` → temp copy `/tmp/spine-consumer-pilot-IACXbQ`). Historical production consumer: [searchATon](https://github.com/searchATon) (bug reports SP-095–098, SP-101–105); not available on operator disk for this run.  
**pi-spine commit:** `c19a7e7ba3765f5aa608eee09564660c74f5b852`  
**pi version:** 0.79.2  

## Environment

| Check | Result | Notes |
|-------|--------|-------|
| `spine doctor` | pass | Consumer temp repo after `spine init` |
| `SPINE_WORKER_STUB` unset for real-pi runs | N/A | Stub phase only (SP-215); real-pi deferred to SP-233 |
| Pinned `SPINE_BIN` or `node …/bin/spine.mjs` | pass | `node /Users/cdelgado/Documents/github/pi-spine/.worktrees/spine-20260612T232227/lane-1/bin/spine.mjs` |
| Taskplane mutual exclusion (if applicable) | N/A | Greenfield adoption fixture layout |
| `spine rules discover` + committed manifest | pass | Manifest created by `spine init` on consumer copy |

## Batches run

| Batch ID | Scope | Mode | Outcome | Duration |
|----------|-------|------|---------|----------|
| 20260612T232300 | AD-001 (1 task stub) | `SPINE_WORKER_STUB=1`, attached | pass | ~6s |
| | 1 task real pi | attached (`--attached`) | pending | **SP-233** |
| | 2 tasks real pi (multi-lane) | attached | skipped | Optional — AD-001 + AD-002 on consumer copy |

**Real-pi fixture (optional):** `./scripts/real-pi-adoption-e2e.sh --batch --keep-tmp` — **SP-233**

## Land loop

- [ ] `spine preflight` — **SP-233**
- [x] `spine batch start` / `spine batch resume --attached` — stub batch `20260612T232300` completed attached
- [x] `spine status --diagnose` (no `state_drift`; cache matches journal rebuild) — `stateDrift.drifted: false`
- [ ] `spine gate approve` — gate opened; integrate pending (**SP-233**)
- [ ] `spine integrate`
- [ ] `spine batch complete`
- [ ] Push `main` (if remote workflow applies)

## Recovery exercised

Document at least one path you actually ran (not theoretical):

- [ ] Orphan / retry — `spine batch retry <id>` then `spine batch resume --attached`
- [ ] Detached resume — `spine batch resume` with `--wait-terminal` after orphan
- [ ] `state_drift` — diagnosis surfaced; retry + `--force` resume resolved
- [ ] `spine handoff` used after session break (journal continuity)

**Recovery notes:**

```text
Stub phase (SP-215): no recovery path exercised. Deferred to SP-233 on consumer copy or searchATon when available.
```

## Journal evidence (excerpt)

Paste tail from `.spine/runtime/<batchId>/journal/events.jsonl` or `spine status --diagnose` output:

```json
{"type":"task.started","batchId":"20260612T232300","taskId":"AD-001"}
{"type":"lane.committed","batchId":"20260612T232300","payload":{"commitSha":"983b0a70160ddfac2fdd2f963fb60a88ed35f2d3"},"taskId":"AD-001"}
{"type":"task.completed","batchId":"20260612T232300","taskId":"AD-001"}
{"type":"batch.merge_completed","batchId":"20260612T232300","payload":{"mergeCommit":"a76ca9a90d4a610f86752d279916113ffa47cd11"}}
{"type":"batch.completed","batchId":"20260612T232300"}
{"type":"gate.opened","batchId":"20260612T232300","payload":{"kind":"integrate","status":"pending"}}
```

**Lane commit(s):** `983b0a70160ddfac2fdd2f963fb60a88ed35f2d3` (lane-1, AD-001)  
**`.DONE` marker(s):** `.worktrees/spine-20260612T232300/lane-1/taskplane-tasks/AD-001-smoke/.DONE`

## Automated regression (pi-spine checkout)

| Command | Result |
|---------|--------|
| `npm run typecheck && SPINE_WORKER_STUB=1 npm test` | pass (SP-215 Step 2) |
| Real-pi CI or `./scripts/real-pi-adoption-e2e.sh --batch` | pending — **SP-233** |

## Sign-off

**Verdict:** pending — stub phase complete; real-pi and operator sign-off in **SP-233**

**Tier 3 criteria met:**

- [ ] Teammate can install from git/path and `spine doctor` passes
- [ ] Consumer repo completed init → plan → batch → gate → integrate → complete
- [ ] At least one stub-free batch with real `pi` workers
- [ ] Operator runbook procedures followed (preflight, land loop, recovery)
- [ ] Known v1.1 gaps tracked; none block daily use

**Blockers for daily use:**

```text
Real-pi batch, full land loop (gate approve → integrate → complete), and recovery path not yet exercised on consumer repo. Tracked in SP-233.
```

— SP-215 worker, 2026-06-12 (skeleton); operator sign-off placeholder until SP-233
