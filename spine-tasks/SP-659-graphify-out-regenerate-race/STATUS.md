# SP-659: `graphify-out` regenerate-after-clean race — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm graphify-out markers present
- [x] Trace sanitize → recheck → fail path

### Step 1: Race-safe re-clean
**Status:** ✅ Complete
- [x] Re-clean / second sanitize before fail-closed land
- [x] Prefer minimal dirty-check/commit change
- [x] Add regenerate-after-clean fixture

### Step 2: Testing & Verification
**Status:** 🔄 In Progress
- [x] Run contract testCommand
- [x] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Close #206 when criteria met

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-656 already changed `lane-dirty-check.mjs` on main | Operator amended Contract `fileScopeMustChange` to STATUS.md + new race test (see PROMPT ## Amendments) |
| `graphify-out/` already in `GITIGNORED_ARTIFACT_MARKERS` | Confirm — markers present; race is post-sanitize regen before GitignoredDirtyWorktree |
| Race window | `commitLaneAndValidateWorktree` sanitizes once, then `commitLaneWorktree` re-lists ignored; regen between them → fail |
| `commitLaneWorktree` impact HIGH | Narrow fix: re-sanitize once when fail-closed on worktree-only marked artifacts; re-sanitize after successful commit for post-commit hooks |
| Multi-pass sanitize blew >500 LOC | Keep race fix in `lane-commit.mjs` only; restore single-pass sanitize |
| `gitignored-index-detect` used marked `coverage/` | Retarget to unmarked `.cache-local/` so fail-closed remediation assertions remain valid |

## Completion Criteria

- [x] Race-safe graphify-out land
- [ ] #206 closable
- [x] Scoped tests green

## Blockers

_None._
