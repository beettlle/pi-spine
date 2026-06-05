# SP-119: Require Testing step in docs-only task packets — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-05
**Review Level:** 0
**Size:** S

---

### Step 1: Skill and template updates
**Status:** ✅ Complete

- [x] Document: Review Level 0 docs-only tasks still need Testing step (may skip coverage gate checkbox)
- [x] Template: Testing step must appear inside `## Steps` before `## Completion Criteria`
- [x] Add checklist item in Definition of Ready

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test` (no product code change expected)

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] STATUS.md complete
- [ ] Create `.DONE`

---

## Completion Criteria

- [x] Skill explicitly forbids omitting Testing step for docs-only tasks
- [x] Template example shows correct section order
