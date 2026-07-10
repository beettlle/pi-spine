# SP-580: Split detached-start.mjs — Status

**Current Step:** Step 2
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for detached-start.mjs (`_explore/batch-module-split-v23/findings.md`)
- [x] List public exports to preserve (spawn re-exports, diagnostics, wait/resume, start/resume entrypoints)

### Step 1: Extract detached-diagnostics.mjs
**Status:** ✅ Complete

- [x] Create module ≤500 LOC (255 LOC)
- [x] Re-export from detached-start.mjs

### Step 2: Testing & Verification
**Status:** 🔄 In Progress

- [ ] `node --test tests/batch/detached-start-orphan-timeout.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Extracted: failure collection, log tails, formatted output → `detached-diagnostics.mjs`
- Deferred to SP-598: thin shim ≤500 LOC for `detached-start.mjs` (currently 670 LOC)

## Discoveries

| Finding | Impact |
|---------|--------|
| argv builders already in `detached-spawn.mjs` | diagnostics extract only; no duplicate |
