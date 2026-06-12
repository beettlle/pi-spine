# Consumer pilot sign-off — Tier 3

Fill this report after completing **Tier 3** adoption on a real consumer repository: stub batch, real-pi batch(es), full land loop, and at least one recovery path exercised. Closes [FR-REL-07](../PRD-v2.1-reliability-handoff.md) (Phase 22).

**When to file:** After [bootstrap-checklist.md](./bootstrap-checklist.md) Tier 1–2 are green and you are ready to sign off daily-operator use per [real-project-readiness.md](./real-project-readiness.md).

**Related:** [operator-runbook.md](./operator-runbook.md) (attached-first, land loop), [real-pi-e2e.md](./real-pi-e2e.md) (fixture evidence format), [local-install.md](./local-install.md) (install path).

---

**Date:** YYYY-MM-DD  
**Operator:**  
**Consumer repo:** (path or URL)  
**pi-spine commit:**  
**pi version:**  

## Environment

| Check | Result | Notes |
|-------|--------|-------|
| `spine doctor` | pass / fail | |
| `SPINE_WORKER_STUB` unset for real-pi runs | pass / fail | |
| Pinned `SPINE_BIN` or `node …/bin/spine.mjs` | pass / fail | Avoid stale global `spine` on PATH |
| Taskplane mutual exclusion (if applicable) | pass / N/A | `spine doctor` / `spine preflight` |
| `spine rules discover` + committed manifest | pass / N/A | When `.cursor/rules/` exists |

## Batches run

| Batch ID | Scope | Mode | Outcome | Duration |
|----------|-------|------|---------|----------|
| | 1–2 tasks stub | `SPINE_WORKER_STUB=1`, attached | pass / fail | |
| | 1 task real pi | attached (`--attached`) | pass / fail | |
| | 2 tasks real pi (multi-lane) | attached | pass / fail / skipped | Optional — adoption fixture AD-001 + AD-002 |

**Real-pi fixture (optional):** `./scripts/real-pi-adoption-e2e.sh --batch --keep-tmp`

## Land loop

- [ ] `spine preflight`
- [ ] `spine batch start` / `spine batch resume --attached`
- [ ] `spine status --diagnose` (no `state_drift`; cache matches journal rebuild)
- [ ] `spine gate approve`
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
(symptom, commands run, outcome)
```

## Journal evidence (excerpt)

Paste tail from `.spine/runtime/<batchId>/journal/events.jsonl` or `spine status --diagnose` output:

```json
{"type":"task.step_completed","taskId":"…"}
{"type":"review.completed","payload":{"verdict":"APPROVE"}}
{"type":"batch.completed","batchId":"…"}
```

**Lane commit(s):**  
**`.DONE` marker(s):**

## Automated regression (pi-spine checkout)

| Command | Result |
|---------|--------|
| `npm run typecheck && SPINE_WORKER_STUB=1 npm test` | pass / fail / N/A |
| Real-pi CI or `./scripts/real-pi-adoption-e2e.sh --batch` | pass / fail / documented skip |

## Sign-off

**Verdict:** pass / fail with issues  

**Tier 3 criteria met:**

- [ ] Teammate can install from git/path and `spine doctor` passes
- [ ] Consumer repo completed init → plan → batch → gate → integrate → complete
- [ ] At least one stub-free batch with real `pi` workers
- [ ] Operator runbook procedures followed (preflight, land loop, recovery)
- [ ] Known v1.1 gaps tracked; none block daily use

**Blockers for daily use:**

```text
(list or "none")
```

— Operator name, YYYY-MM-DD
