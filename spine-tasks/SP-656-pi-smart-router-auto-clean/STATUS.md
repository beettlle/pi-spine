# SP-656: `.pi-smart-router` auto-clean markers — Status

**Current Step:** Step 1 — Add markers + tests
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm `.pi-smart-router/` absent from both marker arrays
- [x] Confirm `.review/` pattern to mirror

### Step 1: Add markers + tests
**Status:** 🔄 In Progress
- [x] Add markers to both GITIGNORED_ARTIFACT_MARKERS arrays
- [x] Add/extend tests for match + sanitize
- [x] Keep marker lists identical for this entry

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Do not close #205

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `.pi-smart-router/` absent from both `GITIGNORED_ARTIFACT_MARKERS` | Mirror `.review/` — markers + `gitignoredArtifactRootForPath` root branch |
| `pi-smart-router-dirty.test.mjs` does not exist yet | Create new test file in File Scope |
| Real-pi session (`SPINE_WORKER_RUNNER` set) | Plan review via tool returns skipped; engine reviews after `.DONE` |
| `.pi-smart-router/` already in root `.gitignore` | Sanitize tests can rely on that ignore pattern |

## Plan (Review Level 1)

1. Add `/.pi-smart-router/` and `.pi-smart-router/` next to `.review/` entries in both marker arrays.
2. Add `.pi-smart-router` root branch in `gitignoredArtifactRootForPath` in both files.
3. Create `tests/batch/pi-smart-router-dirty.test.mjs` covering path match, root listing, and sanitize of shm/wal/state.db.
4. Keep both marker lists identical for this entry.

## Completion Criteria

- [ ] `.pi-smart-router/` auto-clean on both marker lists
- [ ] Scoped tests green
- [ ] #205 still open

## Blockers

_None._
