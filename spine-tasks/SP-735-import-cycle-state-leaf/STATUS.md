# SP-735: Break batch-state-io and meta-reconstruct cycle variants — Status

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

- [ ] Remaining allowlist after SP-733/734
- [ ] SP-734 integrated

## Step 1: Leaf extraction for state-io / meta-reconstruct edges

**Status:** ⬜ Not Started

- [ ] Break cycle imports

## Step 2: Shrink allowlist

**Status:** ⬜ Not Started

- [ ] Remove eliminated strings

## Step 3: Testing & Verification

**Status:** ⬜ Not Started

- [ ] Run lint + Contract testCommand

## Step 4: Documentation & Delivery

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
| 2026-08-28 | Contract amend | fileScopeMustChange → batch-meta-reconstruct.mjs (import-cycles pre-landed by SP-733) |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
