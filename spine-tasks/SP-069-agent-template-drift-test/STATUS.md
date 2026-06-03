# SP-069: Agent template drift test — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read final worker.md and worker-prompt module from SP-067
- [ ] List required substrings / behaviors to lock in tests

---

### Step 1: Implement drift test
**Status:** ⬜ Not Started

- [ ] Create `tests/agents/template-drift.test.mjs` with cases:
  - `worker.md` mentions `spine_review_step`, `spine_report_progress`, stall checkpoint / journal heartbeat
  - `worker.md` mentions **77%** line coverage when SP-061 policy text present (skip or conditional if SP-061 not merged — document in test comment)
  - Runner prompt builder output includes aligned commit hint (from SP-064) and does not contain contradictory legacy phrases
  - Optional: review level > 0 hint present when `readReviewLevel` would return 2

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Confirm new test fails if worker.md or runner hints regress (sanity: temporarily break locally, revert)

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
| 2026-06-03 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
