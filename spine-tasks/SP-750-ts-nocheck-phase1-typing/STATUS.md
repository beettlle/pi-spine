# SP-750: Phase 1 high-risk modules remove @ts-nocheck — Status

**Current Step:** 0
**Status:** ⚪ Not Started
**Last Updated:** 2026-09-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⚪ Not Started

- [ ] Confirm SP-749 guard exists and allowlist format
- [ ] Note which Phase 1 targets still have `@ts-nocheck`

---

### Step 1: Type Phase 1 modules + expand batch tsconfig
**Status:** ⚪ Not Started

- [ ] Remove `@ts-nocheck` from Phase 1 targets; add JSDoc as needed
- [ ] Expand `tsconfig.batch.json` `include`
- [ ] Shrink arch allowlist for cleaned files

---

### Step 2: Testing & Verification
**Status:** ⚪ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Update #266 checklist / follow-up notes
- [ ] Create `.DONE`
