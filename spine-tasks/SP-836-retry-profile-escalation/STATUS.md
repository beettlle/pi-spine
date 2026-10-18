# SP-836: `spine batch retry --profile` and `agents.escalatePolicy` escalation — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `retryTask`, `resetTaskForRetry`, `stripBatchFlagValueTokens`
- [ ] Record the exact content-failure classification strings

### Step 1: `--profile` and auto escalation
**Status:** ⬜ Not Started

- [ ] Flag parsing, validation, eligibility gate
- [ ] `escalatePolicy` auto path and `--no-escalate`
- [ ] `profileOverride` preserved; journal payload extended

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] `--profile` on `contract_failed` sets override; on `provider_quota_exhausted` errors
- [ ] Unknown profile errors
- [ ] Auto escalation on `review_exhausted` when enabled; not when disabled; not on quota/launch classes; `--no-escalate`
- [ ] `task.retry_requested` payload fields

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook retry/escalation section
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-836-retry-profile-escalation/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
