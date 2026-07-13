# SP-649: Wrong-cwd config missing message — Status

**Current Step:** Step 1 — Honest missing-config message
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
**Status:** 🔄 In Progress
- [ ] Include resolved project root / `$PWD` in error message
- [ ] Suggest cd-to-root **or** `spine init` (not bare init alone)
- [ ] Keep fail-closed behavior when config is truly absent

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Add wrong-cwd-config-message test
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Missing-config at `loadSpineConfigFile` L60–68 returns `suggestedCommand: "spine init"` with no cwd | Update message + suggestedCommand to include resolved root and dual remediation (cd root or init here) |
| GitNexus impact on `loadSpineConfigFile` is CRITICAL (71 callers) | Safe: only CONFIG_MISSING string fields change; code/fail-closed unchanged |
| Real-pi session (`SPINE_WORKER_RUNNER` set) | Plan review via `spine_review_step` expected to skip; engine reviews after `.DONE` |
| Some out-of-scope tests assert exact `suggestedCommand === "spine init"` via load path | If coverage:check fails, soften those asserts to match dual-remediation shape (logically required) |

## Plan (Review Level 1)

1. In `loadSpineConfigFile` CONFIG_MISSING branch: `path.resolve(projectRoot)` into message and suggestedCommand.
2. Message: config not found under resolved root; wrong cwd possible; cd to project root **or** `spine init` here.
3. suggestedCommand: not bare `spine init` — include resolved root + dual remediation.
4. Keep `code: "CONFIG_MISSING"`, `config: null`, fail-closed.
5. Add scoped test; run contract + coverage:check.

## Completion Criteria

- [ ] Missing-config load path mentions cwd and dual remediation
- [ ] Scoped test green

## Blockers

_None._
