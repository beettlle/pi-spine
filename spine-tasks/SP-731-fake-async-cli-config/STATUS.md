# SP-731: Remove fake-async in CLI, config, and analyze — Status

**Current Step:** Step 0
**Status:** ⬜ Not Started
**Last Updated:** 2026-08-28
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

## Step 0: Preflight

**Status:** ⬜ Not Started

- [ ] Read #270 acceptance criteria
- [ ] Map callers with `rg`

## Step 1: Remove fake-async (sync path)

**Status:** ⬜ Not Started

- [ ] Drop `async` or add real `await` on five exports
- [ ] Update callers / JSDoc
- [ ] Preserve behavior

## Step 2: Testing & Verification

**Status:** ⬜ Not Started

- [ ] Run lint
- [ ] Run Contract `testCommand`
- [ ] Fix failures

## Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-28 | Task staged | v2.17.0 release Phase 3 |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
