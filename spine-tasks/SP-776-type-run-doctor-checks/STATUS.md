# SP-776: Type run-doctor-checks — Status

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

- [ ] Confirm SP-775 landed
- [ ] Confirm nocheck on target
- [ ] Dependencies satisfied

### Step 1: Type run-doctor-checks
**Status:** ⬜ Not Started

- [ ] Remove nocheck + JSDoc/casts
- [ ] Expand tsconfig.batch include
- [ ] Shrink allowlist entry
- [ ] No #284 targets left allowlisted

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] lint + Contract testCommand
- [ ] Full suite (worker env unset)
- [ ] Coverage gate ≥77%
- [ ] Fix failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Operator amendment 2026-09-26: `tsconfig.batch.json` + arch guard pre-changed on `main` by SP-774 | `fileScopeMustChange` redirected to `run-doctor-checks.mjs`; still edit tsconfig/allowlist in Step 1 |

## Completion Criteria

- [ ] run-doctor-checks typed
- [ ] No #284 allowlist entries
- [ ] Closes #284

## Blockers

_None yet._
