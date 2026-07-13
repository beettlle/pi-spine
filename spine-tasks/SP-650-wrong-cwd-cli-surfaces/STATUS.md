# SP-650: Wrong-cwd CLI surfaces — Status

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
- [x] Inventory hard-coded suggestedCommand for missing-config
- [x] Confirm SP-649 message shape

### Step 1: Shared helper + wire surfaces
**Status:** ✅ Complete
- [x] Add missing-config-hint.mjs
- [x] Wire plan/tasks/discovery
- [x] Refactor load path if duplicated

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Add wrong-cwd-cli-surfaces test
- [x] Run contract testCommand
- [x] Fix scoped failures
- [x] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** 🔄 In Progress
- [ ] Create `.DONE`
- [ ] Close #202 when criteria met

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-649 already sets honest message+suggestedCommand in `loadSpineConfigFile` | Extract into shared helper; load calls helper (single source of truth) |
| In-scope hardcodes: `bin/spine-plan.mjs` L82, `bin/spine-tasks.mjs` L191 (tasksRoot unset), `discovery.mjs` missing-config/`!tasksRootPath` / `checkTasksValidate` without config | Wire to helper `suggestedCommand`; leave dep/schema/empty-folder `spine init` alone |
| Out of scope: doctor, analyze, migrate, settings fallbacks | Leave per File Scope |
| Real-pi session (`SPINE_WORKER_RUNNER` set) | Engine owns post-`.DONE` reviews; in-worker `spine_review_step` returns skipped |
| `npm run coverage:check` inherits `SPINE_IS_WORKER=1` and aborts startBatch tests | Re-ran with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`; line coverage 89.26% |

## Completion Criteria

- [x] #202 closable
- [x] Shared helper is single source of truth
- [x] Scoped tests green

## Blockers

_None._

## Verification evidence

- Contract: `node --test tests/config/wrong-cwd-config-message.test.mjs tests/config/wrong-cwd-cli-surfaces.test.mjs` — 6 pass, 0 fail
- Coverage: `Line coverage (in-scope): 89.26% (threshold: 77%)` with worker env cleared
