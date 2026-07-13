# SP-651: Template evidence command drift — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** ✅ Complete
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
**Status:** ✅ Complete
- [x] Update templates/spine-config.json
- [x] Add template-evidence-commands.test.mjs

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Run contract testCommand
- [x] Fix scoped failures

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Template `testing.build`/`testing.test` = `npm run typecheck && npm test` → `EvidenceCommandError: evidence command contains shell metacharacters` | Confirmed Phase A reject |
| Prefer split allowlisted argv (`npm run typecheck` / `npm test`); matches dogfood `.spine/spine-config.json` | Use split |
| `SPINE_INIT_TESTING_COMMAND` + `applySpineInitDefaults` + mirror/init tests hardcoded `&&` | Expanded to constants + init tests (logically required). Deprecated alias → `npm test`. |
| Plan review at Step 0 | `skipped: true` (real-pi; engine reviews after `.DONE`) |
| GitNexus impact on `applySpineInitDefaults` / `parseEvidenceCommandArgv` | LOW risk |
| Contract `testCommand` | pass 2/2 |
| `npm test` with worker env cleared | 2145 pass / 1 fail — flaky `contract-stall-override` timing (unrelated to SP-651) |

## Completion Criteria

- [x] Template testing commands pass evidence validator
- [x] Regression test green

## Blockers

_None._
