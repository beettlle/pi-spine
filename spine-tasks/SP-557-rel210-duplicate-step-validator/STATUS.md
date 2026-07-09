# SP-557: duplicate step validator — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-07-09
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #148 and SP-435 duplicate-step incident

**Notes:** SP-435 had duplicate `### Step 0:` (Preflight + Poll semantics). Parser accepted silently; workers confused on checkpoint discipline.

### Step 1: Validator
**Status:** ✅ Complete

- [x] Detect duplicate step numbers in `parseSteps()` or validate layer
- [x] Return actionable error with step numbers

### Step 2: Skill guidance
**Status:** ✅ Complete

- [x] Add Step B note: steps must be sequentially numbered, no duplicates

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run contract `testCommand`
- [x] `spine tasks validate` on a synthetic bad packet in test

**Verification:** `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/tasks/parse-prompt-duplicate-step.test.mjs` — 5/5 pass.

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Comment on #148
- [x] Create `.DONE`
