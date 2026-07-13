# SP-650: Wrong-cwd CLI surfaces — Status

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
- [x] Inventory hard-coded suggestedCommand for missing-config
- [x] Confirm SP-649 message shape

### Step 1: Shared helper + wire surfaces
**Status:** ✅ Complete
- [x] Add missing-config-hint.mjs
- [x] Wire plan/tasks/discovery
- [x] Refactor load path if duplicated

### Step 2: Testing & Verification
**Status:** 🔄 In Progress
- [ ] Add wrong-cwd-cli-surfaces test
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Close #202 when criteria met

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-649 already sets honest message+suggestedCommand in `loadSpineConfigFile` | Extract into shared helper; load calls helper (single source of truth) |
| In-scope hardcodes: `bin/spine-plan.mjs` L82, `bin/spine-tasks.mjs` L191 (tasksRoot unset), `discovery.mjs` missing-config/`!tasksRootPath` / `checkTasksValidate` without config | Wire to helper `suggestedCommand`; leave dep/schema/empty-folder `spine init` alone |
| Out of scope: doctor, analyze, migrate, settings fallbacks | Leave per File Scope |
| Real-pi session (`SPINE_WORKER_RUNNER` set) | Engine owns post-`.DONE` reviews; in-worker `spine_review_step` returns skipped |

## Completion Criteria

- [ ] #202 closable
- [ ] Shared helper is single source of truth
- [ ] Scoped tests green

## Blockers

_None._
