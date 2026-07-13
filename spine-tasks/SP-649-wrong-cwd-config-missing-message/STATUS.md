# SP-649: Wrong-cwd config missing message — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm missing-config branch in `spine-config-load.mjs`
- [x] Reproduce bare `suggestedCommand: "spine init"` today

### Step 1: Honest missing-config message
**Status:** ✅ Complete
- [x] Include resolved project root / `$PWD` in error message
- [x] Suggest cd-to-root **or** `spine init` (not bare init alone)
- [x] Keep fail-closed behavior when config is truly absent

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Add wrong-cwd-config-message test
- [x] Run contract testCommand
- [x] Fix scoped failures
- [x] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** 🔄 In Progress
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Missing-config returned bare `spine init` | Message + suggestedCommand include resolved root and dual remediation |
| GitNexus impact CRITICAL on `loadSpineConfigFile` | Only CONFIG_MISSING strings changed; fail-closed preserved |
| Real-pi session | Plan review skipped; engine reviews after `.DONE` |
| 4 out-of-scope tests asserted bare `suggestedCommand === "spine init"` | Softened asserts for settings show/set + tasks validate (logically required for coverage:check) |
| `npm run coverage:check` / `npm test` under `SPINE_IS_WORKER=1` nested-batch-blocks | Ran with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER` |

## Completion Criteria

- [x] Missing-config load path mentions cwd and dual remediation
- [x] Scoped test green

## Blockers

_None._

## Verification evidence

- Contract: `node --test tests/config/wrong-cwd-config-message.test.mjs` — pass 2 / fail 0
- Coverage: `npm run coverage:check` — Line coverage 89.23% (threshold 77%), fail 0
- Full suite: `npm test` — pass 2146 / fail 0
