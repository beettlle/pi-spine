# SP-746: issue-draft and handoff SBAR-shaped sections — Status

**Current Step:** 3
**Status:** 🔄 Step 3 verification in progress
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
- Idle early-return path in `assembleHandoffData` must also carry background/assessmentReason — done: both return paths now include `background` + `assessmentReason` (also surfaces in `spine handoff --json`)
- Only renderers + tests reference the old headings (`## Diagnosis`, `## Suggested command`, `## Alternatives`) — no parsers elsewhere; confirmed via grep
- GitHub #279 body not fetchable (private); PROMPT.md is canonical
- GitNexus impact: all 4 edited symbols LOW upstream risk; `detect_changes` scope confined to file scope ("high" aggregate is process-count effect of editing the two central renderers, all callers test-covered)
- Docs: `docs/adoption/operator-runbook.md` documents handoff workflow, not markdown section shape — no doc edit needed per PROMPT
- Design note: handoff `## Alternatives` folded into `## Recommendation` (suggested command + unique alternatives); `## Pending tasks`/`## Lane summary`/`## Journal tail`/`## Restore` unchanged; issue-draft `formatDiagnosisBlock` dropped its suggested-command line to avoid duplicating Recommendation

---

### Step 1: Handoff + issue-draft section order
**Status:** ✅ Complete

- [x] Four ordered sections — Situation → Background → Assessment → Recommendation in both renderers
- [x] Map diagnose fields or journal-derived Background — `resolveBackgroundFacts` / `resolveAssessmentReason` (exported from handoff.mjs); map `reconciliation.background`/`assessmentReason`, else derive Background from journalTail + phase + pendingTasks, Assessment from diagnosis + headline
- [x] Empty Background → `(none)` — renderers emit explicit `(none)` when mapped + derived facts are both empty
- [x] Preserve redaction — data via `redactHandoffSecrets`, markdown via `redactHandoffText` (unchanged paths)

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Section order — index-order assertions in issue-draft.test.mjs + spine-handoff.test.mjs
- [x] Fallback without #278 fields — render-time derivation tests in both test files
- [x] `(none)` for empty Background — issue-draft `(none)` test + handoff empty-Background test
- Bonus: golden fixture `tests/fixtures/handoff-golden.md` regenerated for SBAR shape; redaction-in-Background-facts test added
- Evidence: contract test files 35/35 pass (29 baseline + 6 new)

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
