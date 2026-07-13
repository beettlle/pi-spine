# SP-649: Wrong-cwd config missing message — Status

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
- [x] Confirm missing-config branch in `spine-config-load.mjs`
- [x] Reproduce bare `suggestedCommand: "spine init"` today

### Step 1: Honest missing-config message
**Status:** ✅ Complete
- [x] Include resolved project root / `$PWD` in error message
- [x] Suggest cd-to-root **or** `spine init` (not bare init alone)
- [x] Keep fail-closed behavior when config is truly absent

### Step 2: Testing & Verification
**Status:** 🔄 In Progress
- [x] Add wrong-cwd-config-message test
- [x] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Missing-config at `loadSpineConfigFile` L60–68 returned bare `spine init` | Message + suggestedCommand now include resolved root and dual remediation |
| GitNexus impact on `loadSpineConfigFile` is CRITICAL (71 callers) | Safe: only CONFIG_MISSING string fields change; code/fail-closed unchanged |
| Real-pi session (`SPINE_WORKER_RUNNER` set) | Plan review skipped; engine reviews after `.DONE` |
| Some out-of-scope tests assert exact `suggestedCommand === "spine init"` via load path | Soften if coverage:check fails (logically required) |

## Completion Criteria

- [x] Missing-config load path mentions cwd and dual remediation
- [x] Scoped test green

## Blockers

_None._
