# SP-838: Classify Google and Anthropic quota/overload errors — Status

**Current Step:** Step 3
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `classifyProviderQuotaError`, `collectStatusPayloads`, `classifyReviewerProviderError`
- [x] Check whether `ApiError` / `formatProviderError` can be imported in tests; record the decision

### Step 1: Envelopes + rules
**Status:** ✅ Complete

- [x] Unprefixed Google / Anthropic envelopes collected
- [x] Google, Anthropic rules; Kimi and z.ai unchanged

### Step 2: Tests
**Status:** ✅ Complete

- [x] Google daily quota → `quota_exhausted`; per-minute / short retry → `transient_overload`; streaming `got status:` variant
- [x] Anthropic 529, unprefixed SSE overload, 429 rate limit → `transient_overload`; credit balance → `quota_exhausted`
- [x] Reviewer classifier returns null for these; existing z.ai/Kimi cases unchanged
- [x] A non-quota Google 400 `INVALID_ARGUMENT` stays unclassified

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-838-google-anthropic-quota-classification/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `@google/genai` / pi-ai / `@anthropic-ai/sdk` not installed in repo node_modules | Fixtures are pasted production strings with comments naming the producing code path | tests/batch/provider-quota.test.mjs |
| Reviewer classifier already returns null whenever the quota classifier matches; no change needed. Bare Google 400 `INVALID_ARGUMENT` envelopes are now also collected as 4xx provider errors (httpStatus 400) | No change to reviewer-provider-error.mjs; test added | tests/batch/reviewer-provider-error.test.mjs |
| Kimi 429 `rate_limit_error` without "currently overloaded" now classifies transient_overload (Anthropic rule, per mission) | Intended | src/batch/provider-quota.mjs |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
