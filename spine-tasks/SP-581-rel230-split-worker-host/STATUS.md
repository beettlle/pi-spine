# SP-581: Split worker-host.mjs — Status

**Current Step:** Step 2
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for worker-host.mjs — `spine-tasks/_explore/batch-module-split-v23/findings.md`
- [x] List public exports to preserve — `buildWorkerChildEnv`, `runWorker`, `terminateLaneWorkers`

### Step 1: Extract worker-spawn.mjs
**Status:** ✅ Complete

- [x] Create module ≤500 LOC — `worker-spawn.mjs` (316 LOC)
- [x] Re-export from worker-host.mjs — `export { buildWorkerChildEnv } from "./worker-spawn.mjs"`

### Step 2: Testing & Verification
**Status:** 🔄 In Progress

- [ ] `node --test tests/batch/worker-host-env.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Extracted: env (`buildWorkerChildEnv`), spawn (`spawnWorkerChild`, `spawnWorkerHandle`), output streaming (`collectChildOutput`, `markChildPastPreflight`, `terminateHungWorkerChild`)
- Deferred to SP-599: heartbeat/stall loop in `runWorker`
