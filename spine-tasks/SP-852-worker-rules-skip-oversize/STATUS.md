# SP-852: Worker rules loader skips an oversize rule and keeps loading — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-11-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `loadContextDocEntries`; report the blast radius in STATUS
- [ ] `rg -n "remaining paths omitted|truncated" tests/` — list assertions that change

### Step 1: Skip and continue
**Status:** ⬜ Not Started

- [ ] Oversize path skipped with reason `byte_cap`; loop continues
- [ ] `truncated` and marker text reflect skipped paths

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Oversize first / middle / all fit, at worker and reviewer caps
- [ ] `skipped` lists path, reason, size

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-852-worker-rules-skip-oversize/.DONE`

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
