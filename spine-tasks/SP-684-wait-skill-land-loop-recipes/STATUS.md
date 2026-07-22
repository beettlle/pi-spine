# SP-684: Wait/skill land-loop recipes after #221 — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-22
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-683 diagnose behavior
- [x] Inventory wait `--until` lists

### Step 1: Align wait recipes with taxonomy needs_integrate
**Status:** ✅ Complete
- [x] Update skill/agent-wave wait recipes
- [x] Cross-link runbook pseudos if useful
- [x] Keep detached-first guidance

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Full test suite (docs-only)
- [x] Spot-check skill text vs SP-683

### Step 3: Documentation & Delivery
**Status:** 🔄 In Progress
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Release operator wait lists already include `needs_integrate`; add explicit taxonomy guidance and cross-link to runbook pseudos | Updated skill text with concise note in `skills/spine-release-operator/SKILL.md` |
| Orchestrate waves and agent-orchestrated-waves already use `needs_integrate` in default wait lists | Added same taxonomy note and runbook cross-link in `skills/spine-orchestrate-waves/SKILL.md` and `docs/adoption/agent-orchestrated-waves.md` |
| Detached-first guidance untouched | No `--attached` added to agent shells |
| `npm run typecheck` passed | No type errors from doc-only changes |
| `SPINE_WORKER_STUB=1 npm test` failed 43 tests | All failures are `SPINE_IS_WORKER=1` nested batch spawn blocking — environmental in this worker session, unrelated to docs changes |

## Completion Criteria

- [x] Wait recipes reflect taxonomy `needs_integrate` for gate-pending land loops
- [x] #221 AC4 satisfied

## Blockers

_None yet._
