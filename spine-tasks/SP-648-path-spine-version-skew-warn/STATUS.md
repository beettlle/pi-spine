# SP-648: PATH spine version skew warn — Status

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
- [x] Confirm duplicate-install / version print behavior
- [x] Define skew detection

### Step 1: Warn on PATH vs checkout skew
**Status:** ✅ Complete
- [x] Detect CLI vs checkout package.json skew
- [x] Surface on doctor and/or version
- [x] Suggested remediation

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Fixture for skew warn
- [x] Contract testCommand
- [x] Fix scoped failures

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create .DONE

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| stale-path.mjs compares PATH vs running PACKAGE_ROOT; #204 needs running CLI vs cwd checkout package.json | Extended duplicate-install.mjs with `detectPathSpineVersionSkew` / `buildCheckoutVersionSkewDoctorCheck` |
| Skew only when cwd/package.json name is `pi-spine` | `readCheckoutPiSpineVersion` filters by package name |

## Completion Criteria

- [x] #204 closable
- [x] Skew warn path covered by test

## Blockers

_None._
