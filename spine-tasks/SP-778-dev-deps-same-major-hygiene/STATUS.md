# SP-778: Same-major dev dependency hygiene — Status

**Current Step:** Step 0 — Preflight
**Status:** ⬜ Not Started
**Last Updated:** 2026-09-26
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Record npm outdated
- [ ] Confirm latest same-major versions
- [ ] Dependencies satisfied

### Step 1: Bump dev dependencies
**Status:** ⬜ Not Started

- [ ] Edit devDependencies
- [ ] npm install (lockfile)
- [ ] npm audit 0 high/critical
- [ ] lint + typecheck clean

### Step 2: Update version-pin docs
**Status:** ⬜ Not Started

- [ ] README / npm-publish / operator-runbook pin
- [ ] No stale `^0.87.0`

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] lint + Contract testCommand
- [ ] Full suite (worker env unset)
- [ ] Coverage gate ≥77%
- [ ] Fix failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| | |

## Completion Criteria

- [ ] Dev deps bumped; lockfile refreshed
- [ ] Docs match pin

## Blockers

_None yet._
