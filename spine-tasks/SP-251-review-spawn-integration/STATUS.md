# SP-251: Review spawn rules injection — Status

**Current Step:** 3 (Testing & Verification)
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-16
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-250 complete
- [x] spawnReviewerPi assembly read

---

### Step 1: Wire review spawn
**Status:** ✅ Complete

- [x] Scope + context before spawnReviewerPi
- [x] Append to systemPrompt
- [x] Stub path unchanged

---

### Step 2: Reviewer template + tests
**Status:** ✅ Complete

- [x] reviewer.md note added
- [x] Integration test for system prompt

---

### Step 3: Testing & Verification
**Status:** 🟡 In Progress

- [ ] FULL test suite passing
- [ ] Coverage gate ≥77%

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Integration notes logged
- [ ] `.DONE` created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `buildReviewerSystemPrompt` exported for tests; wires `resolveReviewScopePaths` + `buildReviewerContext` after `loadReviewerPrompt` | integration | `src/batch/review.mjs` |
| Rules append only on non-stub spawn path; `buildReviewRequest` unchanged | contract | `src/batch/review.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-14 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-16 | Step 0 preflight | SP-250 `buildReviewerContext` verified |
| 2026-06-16 | Step 1 | `buildReviewerSystemPrompt` wired into `runStepReview` |
| 2026-06-16 | Step 2 | `reviewer.md` note + `review-reviewer-rules.test.mjs` |

---

## Blockers

*None*
