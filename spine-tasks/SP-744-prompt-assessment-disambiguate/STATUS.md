# SP-744: Disambiguate PROMPT Assessment field — Status

**Current Step:** 3
**Status:** 🔵 In Progress
**Last Updated:** 2026-09-04
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm current template uses overloaded `**Assessment:**` — `skills/create-spine-tasks/references/prompt-template.md` Review Level block: `**Assessment:** [1-2 sentences explaining the score]` (overloaded with **Score** blast explanation; issue #281 confirms packets also use it for fault theories)
- [x] Confirm validators accept legacy Assessment — grep of `src/`, `bin/`: no validator parses `**Assessment:**`; only `REVIEW_LEVEL_RE` matches `## Review Level:` in `src/batch/review-shared.mjs:10`. Legacy field is doc-level, tooling-agnostic → remains valid by default.

---

### Step 1: Template + authoring rule
**Status:** ✅ Complete

- [x] Add Risk / Problem theory (or canonical meaning + deprecation) — template Review Level block now: `**Risk:**` (severity/blast, pairs with **Score**) + `**Problem theory:**` (optional working diagnosis), with #281 disambiguation callout documenting legacy `**Assessment:**` acceptance
- [x] Example in prompt-template.md — added "Example — Review Level block fields (#281)" section after the PROMPT template fence with Risk/Score/Problem theory example
- [x] Update spine-task-authoring.mdc — "Assessment field names (#281)" guidance under Review level rubric with ❌/✅/⚠️/🔧/**Detect:** anti-pattern block; links #278 collision
- [x] Legacy Assessment still valid — no tooling change; template/rule text explicitly documents legacy acceptance

---

### Step 2: Optional adoption note
**Status:** ✅ Complete

- [x] Note in templates/tasks/CONTEXT.md — added one-bullet "Authoring notes" section (Risk/Problem theory for new packets, legacy valid, links #281)
- [x] No historical PROMPT mass rewrite — no files under `spine-tasks/*/PROMPT.md` modified (only this packet's STATUS.md)

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Template + rule show unambiguous fields
- [ ] Optional validate sample

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Docs updates complete
- [ ] Create `.DONE`

---

### Completion Criteria

- [ ] Unambiguous fields in template/rule
- [ ] Legacy Assessment accepted
- [ ] Example present
- [ ] Closes #281
- [ ] `.DONE` created
