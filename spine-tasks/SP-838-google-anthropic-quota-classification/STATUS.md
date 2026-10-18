# SP-838: Classify Google and Anthropic quota/overload errors — Status

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

- [ ] GitNexus impact on `classifyProviderQuotaError`, `collectStatusPayloads`, `classifyReviewerProviderError`
- [ ] Check whether `ApiError` / `formatProviderError` can be imported in tests; record the decision

### Step 1: Envelopes + rules
**Status:** ⬜ Not Started

- [ ] Unprefixed Google / Anthropic envelopes collected
- [ ] Google, Anthropic rules; Kimi and z.ai unchanged

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Google daily quota → `quota_exhausted`; per-minute / short retry → `transient_overload`; streaming `got status:` variant
- [ ] Anthropic 529, unprefixed SSE overload, 429 rate limit → `transient_overload`; credit balance → `quota_exhausted`
- [ ] Reviewer classifier returns null for these; existing z.ai/Kimi cases unchanged
- [ ] A non-quota Google 400 `INVALID_ARGUMENT` stays unclassified

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-838-google-anthropic-quota-classification/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
