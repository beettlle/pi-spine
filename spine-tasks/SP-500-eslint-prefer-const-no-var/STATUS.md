# SP-500: Expand ESLint baseline rules — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-07-05
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Current lint baseline passes
- [ ] Violation count estimated per new rule
- [ ] Dependencies satisfied

---

### Step 1: Add ESLint rules
**Status:** ⬜ Not Started

- [ ] `prefer-const`, `no-var`, `no-async-promise-executor` added to `eslint.config.js`
- [ ] Rules scoped to configured dirs only
- [ ] Violation list captured

---

### Step 2: Fix prefer-const violations
**Status:** ⬜ Not Started

- [ ] `let` → `const` where bindings never reassigned
- [ ] Reassigned bindings refactored only when necessary
- [ ] Lint passes for prefer-const

---

### Step 3: Fix no-var and no-async-promise-executor violations
**Status:** ⬜ Not Started

- [ ] `var` replaced with `let`/`const`
- [ ] Async Promise executors refactored
- [ ] Lint: 0 errors, 0 warnings

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77% line coverage on in-scope code)
- [ ] Lint produces 0 warnings, 0 errors
- [ ] All failures fixed
- [ ] Build passes

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged
- [ ] GitHub issue #179 closed

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-05 | Task staged | PROMPT.md and STATUS.md created (v1.8.0 wave 0) |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
