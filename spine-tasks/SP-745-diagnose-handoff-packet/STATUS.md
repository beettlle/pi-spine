# SP-745: Diagnose handoff packet background + assessmentReason — Status

**Current Step:** 0
**Status:** ⬜ Not Started
**Last Updated:** 2026-09-04
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Map `buildDiagnosisOutput` return shape and callers
- [ ] Map human `--diagnose` and `--json` surfaces

---

### Step 1: Additive fields on diagnose output
**Status:** ⬜ Not Started

- [ ] Add `background: string[]`
- [ ] Add `assessmentReason: string`
- [ ] Preserve existing fields

---

### Step 2: Human CLI + tests
**Status:** ⬜ Not Started

- [ ] Four-role human layout
- [ ] `--json` includes new fields
- [ ] Tests for needs_retry, orphan taxonomy, needs_integrate

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] lint
- [ ] Contract testCommand
- [ ] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] STATUS note if runbook touch deferred to SP-743
- [ ] Create `.DONE`

---

### Completion Criteria

- [ ] JSON + human four-role output
- [ ] Backward compatible
- [ ] Tests for three diagnoses
- [ ] Closes #278
- [ ] `.DONE` created
