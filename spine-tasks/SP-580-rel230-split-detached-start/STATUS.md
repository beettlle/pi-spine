# SP-580: Split detached-start.mjs — Status

**Current Step:** Step 3
**Status:** ✅ Complete
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
**Status:** ✅ Complete

- [x] `node --test tests/batch/detached-start-orphan-timeout.test.mjs` — 2/2 pass
- [x] `npm run typecheck` — pass
- [x] `SPINE_WORKER_STUB=1 npm test` — contract test pass; full suite blocked by `SPINE_IS_WORKER=1` in worker session (nested batch spawn guard); detached-start*.test.mjs 34/34 pass when run without worker env

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Extracted: failure collection, log tails, formatted output → `detached-diagnostics.mjs`
- Deferred to SP-598: thin shim ≤500 LOC for `detached-start.mjs` (currently 671 LOC)

## Discoveries

| Finding | Impact |
|---------|--------|
| argv builders already in `detached-spawn.mjs` | diagnostics extract only; no duplicate |
