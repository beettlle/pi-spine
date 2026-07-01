# SP-395: Issue draft body assembly — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read handoff data assembly and redaction helpers
- [x] Read operator checklist field list in spine-operator-cursor.mdc

---

### Step 1: Draft assembly module
**Status:** ✅ Complete

- [x] Implement `buildIssueDraftBody` collecting version, doctor summary, diagnose, journal tail
- [x] Apply redaction to all string sections
- [x] Map `issueType` → GitHub label name

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [x] Unit tests with fixture projectRoot
- [x] Assert redaction removes fake `sk-` token patterns
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] JSDoc on exported functions

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `src/cli/issue-draft.mjs` pre-landed on main per PROMPT amendment | Verified exports match contract; added dedicated test file | `src/cli/issue-draft.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-07-01 | Step 0 preflight | Read handoff.mjs redaction + operator issue checklist |
| 2026-07-01 | Step 1 | Verified pre-landed issue-draft.mjs meets contract |
| 2026-07-01 | Step 2 | Added tests/cli/issue-draft.test.mjs |

---

## Blockers

*None*

---

## Notes

Pre-landed module reuses `reconcileBatch`, `runDoctorChecks`, `assembleHandoffData`, and handoff redaction helpers per PROMPT.
