# SP-827: Execute tasks run at effective Review Level 0 — Status

**Current Step:** Step 1: Effective level
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [x] Impact analysis recorded
- [x] Execute review tests listed
- [x] Dependencies satisfied

### Step 1: Effective level
**Status:** ⬜ Not Started

- [ ] `effectiveReviewLevel` (typed module)
- [ ] `readReviewLevel` wired (net ≤ 3 lines)

### Step 2: Validate warning
**Status:** ⬜ Not Started

- [ ] Warning helper
- [ ] Wired into `validatePrompt`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Review level cases
- [ ] Validate warning cases

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand` passing (full suite runs at post-integrate `release:check`)
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `readReviewLevel`: CRITICAL, 24 impacted (10 direct callers: engine plan/code/final review phases, review-step-run, metrics buildTaskMetricRecord, agent-session-worker, resume paths). Risk accepted per PROMPT: `llm` packet behavior unchanged; fix confined to `readReviewLevel`. |
| 2 | `rg 'readReviewLevel\|Review Level' tests/ \| rg -i execute`: only `tests/batch/worker-spawn-errors.test.mjs` (execute packet at Level 0 — unaffected) and an adoption fixture; no test expects reviews on execute packets. |
| 3 | Dependency SP-828 satisfied: `scripts/spine-stet-contract-run.sh` and `.review/config.toml` present in worktree. |

## Blockers

_None._
