# SP-749: CI/arch guard against new @ts-nocheck — Status

**Current Step:** 0
**Status:** ⚪ Not Started
**Last Updated:** 2026-09-05
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⚪ Not Started

- [ ] Enumerate current `src/**/*.mjs` with leading `// @ts-nocheck`
- [ ] Confirm how arch tests run in `npm test` / CI

---

### Step 1: Guard test + allowlist
**Status:** ⚪ Not Started

- [ ] Add `tests/arch/ts-nocheck-guard.test.mjs`
- [ ] Seed allowlist from current offenders
- [ ] Document how to shrink the allowlist

---

### Step 2: Testing & Verification
**Status:** ⚪ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Note Phase 0 landed for #266
- [ ] Create `.DONE`
