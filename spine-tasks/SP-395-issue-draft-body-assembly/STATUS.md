# SP-395: Issue draft body assembly — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read handoff data assembly and redaction helpers
- [ ] Read operator checklist field list in spine-operator-cursor.mdc

---

### Step 1: Draft assembly module
**Status:** ⬜ Not Started

- [ ] Implement `buildIssueDraftBody` collecting version, doctor summary, diagnose, journal tail
- [ ] Apply redaction to all string sections
- [ ] Map `issueType` → GitHub label name

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Unit tests with fixture projectRoot
- [ ] Assert redaction removes fake `sk-` token patterns
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] JSDoc on exported functions

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
