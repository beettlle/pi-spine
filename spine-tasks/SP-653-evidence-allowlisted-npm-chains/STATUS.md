# SP-653: Evidence allowlisted npm chains — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** ✅ Complete
**Last Updated:** 2026-07-13
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Document current metacharacter rejection rules
- [x] Define allowlist + &&-only chain grammar

### Step 1: Implement allowlisted `&&` chains
**Status:** ✅ Complete
- [x] Parse/validate multi-segment allowlisted commands
- [x] Execute segments sequentially fail-closed
- [x] Keep scripts/ Phase A path working
- [x] Reject other metacharacters / expansions

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Add evidence-allowlisted-chains.test.mjs
- [x] Extend evidence.test.mjs if needed (not required — Phase A coverage unchanged)
- [x] Run contract testCommand (34 pass)
- [x] Fix scoped failures
- [x] Coverage gate (≥77%) — 89.22% with worker env cleared

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create `.DONE`
- [x] Comment on #160 Phase B; leave open for Phase C — https://github.com/beettlle/pi-spine/issues/160#issuecomment-4960857137

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Template already has `npm run typecheck && npm test` | Leave template unchanged; evidence now accepts Phase B chains |
| `SHELL_METACHAR_PATTERN` matches `&` so `&&` is rejected today | Strip `&&` before metachar scan; still reject lone `&` |
| GitNexus impact on assert/parse/run: LOW | Proceeded with edits |
| Real-pi worker (`SPINE_WORKER_RUNNER` set) | Engine reviews after `.DONE`; in-worker plan review returns skipped |
| Existing evidence.test.mjs still covers Phase A + metachar rejects | No extend required beyond new allowlisted-chains file |
| `npm run coverage:check` inherits `SPINE_IS_WORKER` and fails batch tests | Re-ran with worker env unset; line coverage 89.22% |

## Completion Criteria

- [x] Allowlisted && chains execute
- [x] Other metacharacters rejected
- [x] Phase A scripts/ unchanged
- [x] #160 remains open with Phase B note

## Blockers

_None._
