# SP-847: Runbook and stet overview: threshold gate, stet v1.4.0 floor, review timeout — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-11-01
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read runbook §8.1 and the stet overview; list every sentence that says any active finding fails or shows stet on `testCommand`

### Step 1: Runbook §8.1
**Status:** ⬜ Not Started

- [ ] Contract behavior: threshold gate, env overrides, exit 2, below-threshold note, old-stet fallback
- [ ] Prerequisites: stet ≥ v1.4.0
- [ ] Time budget: `contract.reviewTimeoutMs 1800000` recommendation for stet-gated batches
- [ ] Hazards: dismissals survive line shifts

### Step 2: Stet overview
**Status:** ⬜ Not Started

- [ ] §1 and §5 examples use `reviewCommand`; threshold env vars mentioned

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `rg -l 'operator-runbook.md|stet-overview.md' tests/` and run only the hits with `node --experimental-strip-types --test --test-reporter=dot <files>` (none → note "no tests reference these docs")
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-847-stet-gate-runbook-docs/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
