# SP-840: Engine code review diffs against the task start commit — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `runCodeReviewPhase`, `runEngineCodeReview`, `resolveTaskStartCommit`
- [ ] Confirm `src/batch/journal.mjs` registration pattern (SP-834/835 also add events there — append only)

### Step 1: Validator + wiring
**Status:** ⬜ Not Started

- [ ] `isValidCommitSha`; invalid start commits resolve to `null`
- [ ] Code review receives `baseline`; `review.baseline_missing` when unresolved

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Committed step work with a clean tree: review request contains `git diff <sha>..HEAD`; scope paths non-empty
- [ ] `--evil` / non-hex start commit rejected → `review.baseline_missing`
- [ ] Validator table

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-840-code-review-baseline/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
