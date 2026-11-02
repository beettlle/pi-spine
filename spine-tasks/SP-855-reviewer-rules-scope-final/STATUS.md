# SP-855: Code and final reviewers get glob-scoped rules for the task's files — Status

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

- [ ] GitNexus impact on `resolveReviewScopePaths` and `resolveCodeReviewScopePaths`; report the blast radius in STATUS
- [ ] `rg -n "final returns empty|scopePaths" tests/` — list assertions that change

### Step 1: Scope resolution
**Status:** ⬜ Not Started

- [ ] Code: File Scope fallback on empty diff / error
- [ ] Final: diff with baseline, else File Scope

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Four cases above; existing plan test unchanged

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discovery doc table row and skill Tier 4 / Reviewer rules text updated
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-855-reviewer-rules-scope-final/.DONE`

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
