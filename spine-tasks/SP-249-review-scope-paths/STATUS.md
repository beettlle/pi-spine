# SP-249: Review scope path resolver — Status

**Current Step:** Step 3
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-15
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm parsePrompt File Scope API — `parsePrompt(markdown).fileScope` from `parse-prompt.mjs`
- [x] Confirm baseline threading in code review — `buildReviewRequest` uses `git diff ${baseline}..HEAD --name-only` with fallback `git diff --name-only`

---

### Step 1: Scope resolver
**Status:** ✅ Complete

- [x] `resolveReviewScopePaths` implemented
- [x] plan / code / final behavior
- [x] Noise path filtering

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Per review-type tests
- [x] Noise filtering tests

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate ≥77%

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Export shape in Discoveries
- [ ] `.DONE` created

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
| 2026-06-14 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*
