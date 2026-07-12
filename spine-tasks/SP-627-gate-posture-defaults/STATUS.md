# SP-627: DEFAULT_POSTURES categories table — Status

**Current Step:** Step 1 — Export defaults table
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Required files and paths exist
- [x] Dependencies satisfied

### Step 1: Export defaults table
**Status:** 🟡 In Progress
- [ ] Define categories + posture enums/constants
- [ ] DEFAULT_POSTURES with destroy/auth locked
- [ ] Unit test table shape and locked invariants

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Must Update docs modified (if any)
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Issue #123 table defines postures + thresholds | Use that as authoritative DEFAULT_POSTURES shape |
| Real-pi session (`SPINE_WORKER_RUNNER` set) | Plan review via `spine_review_step` returns skipped; engine reviews after `.DONE` |
| Target module paths absent | Create `src/batch/gate-posture-defaults.mjs` + matching test |

## Plan (Step 1)

Pure data module (no I/O):
1. `GATE_CATEGORIES` — frozen tuple: read, write, execute, destroy, network, auth
2. `POSTURES` — frozen names: permissive, cautious, guarded, locked
3. `DEFAULT_POSTURES` — per-category `{ posture, autoApproveAfterN }` from #123; destroy/auth → locked + `null` threshold
4. Unit tests: every category present; destroy/auth locked; non-locked match documented defaults

## Blockers

_None._
