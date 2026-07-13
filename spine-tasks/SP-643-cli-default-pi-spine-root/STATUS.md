# SP-643: CLI default PI_SPINE_ROOT to cwd — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm doctor fail today
- [x] Confirm resolvePiSpineRoot worker semantics

### Step 1: Default env at CLI bootstrap
**Status:** ✅ Complete
- [x] ensureDefaultPiSpineRootEnv
- [x] bin/spine.mjs call site
- [x] doctor worktree check
- [x] Unit tests

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Contract / scoped tests only (no full suite / coverage in-lane)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [x] Runbook one-liner (done in Step 1 commit scope)
- [ ] Create .DONE

## Plan (Review Level 1)

1. Add `ensureDefaultPiSpineRootEnv()` in `pi-spine-root.mjs` — set cwd only when unset/empty; never override explicit env.
2. Call from `bin/spine.mjs` before command dispatch; also call from doctor worktree check so library/doctor paths get the same default.
3. Leave `resolvePiSpineRoot` package-discovery semantics unchanged for worker spawn.
4. Tests: ensure default/preserve; doctor+hook ok after ensure; existing resolvePiSpineRoot tests still pass.
5. Runbook: one line that CLI defaults unset `PI_SPINE_ROOT` to cwd (#203 / SP-643).

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Task packet missing from lane worktree (only on main checkout) | Copied PROMPT/STATUS into worktree for execution |
| `resolvePiSpineRoot` impact LOW (upstream callers are worker spawn / validate) | Do not change resolve; add separate ensure helper |
| Operator runbook has no PI_SPINE_ROOT note yet | This task owns the one-liner |
| Doctor early-returns when no `.worktrees/` so unset+hook only fails after lanes exist | Preflight repro uses temp dir with `.worktrees/` present |

## Completion Criteria

- [x] `spine doctor` / preflight no longer requires manual export solely because env unset (ensure + doctor call)
- [x] Explicit `PI_SPINE_ROOT` still wins (unit test)
- [x] Worker `resolvePiSpineRoot` package semantics unchanged (existing tests)

## Blockers

_None yet._
