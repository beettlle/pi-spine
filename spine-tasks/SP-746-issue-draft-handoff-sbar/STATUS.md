# SP-746: issue-draft and handoff SBAR-shaped sections — Status

**Current Step:** 1
**Status:** 🔄 Step 1 in progress
**Last Updated:** 2026-09-04
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-745 landed / fields available — commit 0e742af2; `buildDiagnosisOutput` (src/batch/diagnosis.mjs:325) returns `background: string[]` + `assessmentReason: string`; `reconcileBatch` spreads them into its result
- [x] Read current issue-draft and handoff shapes — issue-draft: Summary/Environment/Commands run/Diagnosis/Journal excerpt/Expected/Actual; handoff: header/Diagnosis/Suggested command/Alternatives/Pending tasks/Lane summary/Journal tail/Restore; golden fixture tests/cli/fixtures/handoff-golden.md pins handoff shape

**Notes:**
- Idle early-return path in `assembleHandoffData` must also carry background/assessmentReason
- Only renderers + tests reference the old headings (`## Diagnosis`, `## Suggested command`, `## Alternatives`) — no parsers elsewhere
- GitHub #279 body not fetchable (private); PROMPT.md is canonical

---

### Step 1: Handoff + issue-draft section order
**Status:** ⬜ Not Started

- [ ] Four ordered sections
- [ ] Map diagnose fields or journal-derived Background
- [ ] Empty Background → `(none)`
- [ ] Preserve redaction

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Section order
- [ ] Fallback without #278 fields
- [ ] `(none)` for empty Background

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] lint
- [ ] Contract testCommand
- [ ] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

### Completion Criteria

- [ ] Four sections in issue-draft + handoff
- [ ] `(none)` + redaction + tests
- [ ] Closes #279
- [ ] `.DONE` created
