# SP-651: Template evidence command drift — Status

**Current Step:** Step 1 — Fix template + regression test
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm template fails current evidence parse
- [x] Choose Phase-A-safe replacements

### Step 1: Fix template + regression test
**Status:** 🔄 In Progress
- [x] Update templates/spine-config.json
- [x] Add template-evidence-commands.test.mjs

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract testCommand
- [ ] Fix scoped failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Template `testing.build`/`testing.test` = `npm run typecheck && npm test` → `EvidenceCommandError: evidence command contains shell metacharacters` | Confirmed Phase A reject |
| Prefer split allowlisted argv (`npm run typecheck` / `npm test`); matches dogfood `.spine/spine-config.json` | Use split |
| `SPINE_INIT_TESTING_COMMAND` + `applySpineInitDefaults` + `spine-config-testing.test.mjs` mirror the combined `&&` string | Expand minimally to constants + mirror test (logically required; ask_question UI unavailable — default expand-split). Kept deprecated `SPINE_INIT_TESTING_COMMAND` alias → test command. |
| Plan review at Step 0 | `skipped: true` (real-pi; engine reviews after `.DONE`) |
| GitNexus impact on `applySpineInitDefaults` / `parseEvidenceCommandArgv` | LOW risk |

## Completion Criteria

- [ ] Template testing commands pass evidence validator
- [ ] Regression test green

## Blockers

_None._
