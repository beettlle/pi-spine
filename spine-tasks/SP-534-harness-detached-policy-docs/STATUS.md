# SP-534: Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-08
**Review Level:** see PROMPT
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #185 and #163 (attached orphan context)
- [x] Audit current `--attached` guidance in both skills

### Step 1: Detached-first policy
**Status:** ✅ Complete

- [x] autonomous-operator: default detached + MonitorCreate / `spine wait`; `--attached` only for persistent human terminal
- [x] release-operator Phase 4: reinforce detached start; link agent-shell-batch-policy
### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — typecheck passed; full suite 1800 pass / 46 fail (pre-existing branch failures, none in file scope; contract `testCommand: true` passes)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Comment on #185
- [x] Create `.DONE`

## Completion Criteria

- [x] Both operator skills document detached-first policy
- [x] `--attached` explicitly restricted to persistent interactive shells

## Blockers

*None*
