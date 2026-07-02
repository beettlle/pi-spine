# SP-413: Validate spine-tasks must-not warn — Status

**Current Step:** Step 2 — Validate warning
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-02
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read GitHub issue #63
- [x] Dependencies satisfied (SP-410, SP-412 `.DONE`; SP-411 skill guidance landed)

---

### Step 1: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-410–412 docs landed (contract-template.md, SKILL.md, operator-runbook)

---

### Step 2: Validate warning
**Status:** 🟡 In Progress

- [ ] Emit warning (not error) when must-not-change includes spine-tasks/**
- [ ] Emit warning when pattern matches current task folder
- [ ] Include fix hint in warning message

---

### Step 3: Warn-path unit tests
**Status:** ⬜ Not Started

- [ ] Unit tests for warn paths

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Issue #63 closed
- [ ] .DONE created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SP-411 complete without `.DONE` in worktree; SKILL.md has must-not guidance | Dependency satisfied | `skills/create-spine-tasks/SKILL.md` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-01 | Task staged | PROMPT.md and STATUS.md created for GitHub #63 |
| 2026-07-02 | Preflight | Issue #63 read; SP-410/411/412 docs confirmed |

---

## Blockers

*None*

---

## Notes

Plan (Step 2): Add `collectFileScopeMustNotChangeWarnings` in `validate-contract.mjs` using `matchesContractPattern` probes for `spine-tasks/**` and current-task folder (`{taskId}-*/STATUS.md` etc.). Warnings only — no errors. Fix hint links contract-template semantics.
