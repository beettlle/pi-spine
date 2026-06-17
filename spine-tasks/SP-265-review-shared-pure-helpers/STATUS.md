# SP-265: Extract review-shared pure helpers — Status

**Current Step:** Step 2 (Testing & Verification)
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-17
**Review Level:** 2
**Review Counter:** 1
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Duplication inventory

**Duplicated pure helpers (engine-lanes/review.mjs vs review.mjs):**
| Concern | review.mjs | engine-lanes/review.mjs |
|---------|------------|-------------------------|
| Verdict normalize | `normalizeVerdict` (plan/code/final) | `normalizeFinalVerdict`, `normalizeCodeVerdict` |
| Verdict parse | `parseReviewVerdict` (+ heuristics) | `parseFinalReviewVerdict` (JSON/heading only) |
| Artifact paths | `formatReviewTimestamp`, `buildReviewArtifactPath`, `buildFinalReviewArtifactPath` | imports `buildFinalReviewArtifactPath` from review.mjs |
| Review level | `parseReviewLevel`, `isReviewTypeRequired` | uses `readReviewLevel` from review.mjs |
| Gate helpers | `isReviewTypeRequired` | `shouldRunCodeReview`, `shouldRunFinalReview` |

Baseline: `engine-code-review.test.mjs` cases passed (full `npm test` also hit 2 pre-existing failures in `worker-pi-timeout.test.mjs`).

---

### Step 1: Extract pure helpers
**Status:** ✅ Complete

- [x] review-shared.mjs created
- [x] Unit tests added

**Exported symbols for SP-266:** `REVIEW_LEVEL_RE`, `parseReviewLevel`, `isReviewTypeRequired`, `formatReviewTimestamp`, `buildReviewArtifactPath`, `buildFinalReviewArtifactPath`, `normalizeVerdict`, `normalizeFinalVerdict`, `normalizeCodeVerdict`, `parseReviewVerdict`, `parseFinalReviewVerdict`, `shouldRunCodeReview`, `shouldRunFinalReview`

Plan review Step 1: APPROVE (stub).

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [ ] Suite + coverage green

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] .DONE created

---


## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 1 | plan | 1 | APPROVE | `.reviews/1-20260617T170203.md` |

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `worker-pi-timeout.test.mjs` 2 failures unrelated to SP-265 | Note for full suite | tests/batch/worker-pi-timeout.test.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-17 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-17 | Step 0 preflight | Duplication inventory logged |
| 2026-06-17 | Step 1 extract | review-shared.mjs + tests created; plan review APPROVE |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
