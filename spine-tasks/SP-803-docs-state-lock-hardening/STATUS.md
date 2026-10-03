# SP-803: Runbook — v2.26.0 state and lock hardening — Status

**Current Step:** Step 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-10-03
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Names confirmed against code
- [x] Dependencies satisfied

### Step 1: Write the subsection
**Status:** ✅ Done

- [x] Subsection covers items 1–6
- [x] Names exact

### Step 2: Testing & Verification
**Status:** ✅ Done

- [x] Full suite
- [x] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ✅ Done

- [x] Discoveries logged
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `worker.spawn_failed` `reason: "pi_missing"` is scoped to non-execute, non-`agentSession` workers; execute-only and agentSession workers never consult PATH for `pi` (`src/batch/worker-host.mjs`). |
| 2 | Default `lanes.outOfScopeMergeAllowList` = `.spine/rules-manifest.json`, `package-lock.json`, `**/package-lock.json` (`src/config/defaults.mjs`). |
| 3 | `orchestrator.sequenceMaxWaitMs` default 24 h; `orchestrator.sequenceStallMs` default 30 min (`src/config/spine-config-schema.mjs`). |
| 4 | Contract timeout kills the process tree (SIGTERM, SIGKILL after 2 s grace) via `terminateProcessTree` (`src/batch/contract-spawn.mjs`); summary `testCommand timed out after N min and was terminated` (`src/batch/contract-exec.mjs`). |
| 5 | Runbook has no "Last Updated" header line — nothing to update there. |
| 6 | Full suite green: 2769 pass / 0 fail (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`, ~167 s). |

## Blockers

_None._
