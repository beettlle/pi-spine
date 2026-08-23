# SP-719: Wire tests/arch and tests/fs into npm test — Status

**Current Step:** Step 4: Documentation & Delivery
**Status:** Complete
**Last Updated:** 2026-08-22
**Review Level:** 1
**Size:** S

---

## Step 1: Update coverage policy

- [x] Add arch/fs globs to `TEST_GLOBS`
- [x] Remove arch/fs from `SUITE_DIR_ALLOWLIST`

**Status:** Complete

## Step 2: Align package.json test script

- [x] Ensure default `npm test` includes arch/fs globs (match policy comment)

**Status:** Complete

## Step 3: Testing & Verification

- [x] `tests/coverage/policy.test.mjs` passes
- [x] `tests/arch/import-cycles.test.mjs` runs and passes (allowlisted cycles OK for now)
- [x] Run contract `testCommand` only

**Status:** Complete

## Step 4: Documentation & Delivery

- [x] Create `.DONE`

**Status:** Complete

**Status:** Not Started

## Step 4: Documentation & Delivery

**Status:** Not Started

---

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-22 | Task staged | v2.15.0 release packet |
