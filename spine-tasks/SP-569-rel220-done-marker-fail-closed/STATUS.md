# SP-569: done-marker fail-closed — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-07-09
**Review Level:** 2
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings and #190 evidence
- [x] Identify all `skippedDoneOnDisk: true` emitters (journal-rebuild, attached-runner, resume-multi-lanes)

### Step 1: Reconcile + attached-runner fail-closed
**Status:** ✅ Complete

- [x] Gate reconcile promote on committed `.DONE` via `laneDoneMarkerReadyForPromote`
- [x] Gate attached-runner promote on committed `.DONE`
- [x] Audit resume-multi-lanes — fail-closed before promote in `markTaskCompleteFromDisk`

### Step 2: Pre-merge guard + tests
**Status:** ✅ Complete

- [x] Merge-phase check in `mergeLaneToOrch` when `laneTaskFolders` provided
- [x] New `done-marker-fail-closed.test.mjs`
- [x] Extended SP-512 test — negative #190 case + positive fixture commits `.DONE`

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Contract testCommand
- [x] Full suite (`npm run typecheck && SPINE_WORKER_STUB=1 npm test`)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Runbook section: fail-closed vs `skippedDoneOnDisk` semantics
- [ ] Comment on #190 with behavior summary (operator / integrate)
- [x] Create `.DONE`
