# SP-744: Disambiguate PROMPT Assessment field — Status

**Current Step:** Done
**Status:** ✅ Complete
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
**Status:** ✅ Complete

- [x] Template + rule show unambiguous fields — verified in both files (Risk / Problem theory + #281 callouts)
- [x] Optional validate sample — `spine tasks validate SP-744` → `1 passed, 0 failed`; SP-744 PROMPT itself uses legacy `**Assessment:**` (7 occurrences) → legacy field accepted. Note: `spine tasks validate SP-051` fails, but only on pre-existing structural gaps (missing Testing step / Contract — TP-era packet); Assessment not flagged
- [x] Full test suite — `env -u SPINE_IS_WORKER npm test` → **2558/2558 pass, 0 fail** (187.9s). Raw `npm test` inside the worker session fails `tests/spine-run.test.mjs` with `nested_batch_spawn_blocked` (SP-482 guard inherits `SPINE_IS_WORKER=1`); same file passes 2/2 with the var unset — environmental, not change-related. One transient failure in the first unset run; immediate full rerun clean

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Docs updates complete — Must Update: `skills/create-spine-tasks/references/prompt-template.md`, `.cursor/rules/spine-task-authoring.mdc`; Check If Affected: `templates/tasks/CONTEXT.md` (updated)
- [x] Create `.DONE`

---

### Completion Criteria

- [x] Unambiguous fields in template/rule — `**Risk:**` + `**Problem theory:**` with #281 disambiguation note
- [x] Legacy Assessment accepted — no tooling change; validators never parsed it; SP-744 packet validates with it
- [x] Example present — "Example — Review Level block fields (#281)" section in prompt-template.md
- [x] Closes #281
- [x] `.DONE` created

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Raw `npm test` in worker session fails `tests/spine-run.test.mjs` (`nested_batch_spawn_blocked`, SP-482 guard) | Environmental — passes 2/2 with `SPINE_IS_WORKER` unset; full suite green the same way | `tests/spine-run.test.mjs` |
| `spine tasks validate SP-051` fails | Pre-existing (TP-era packet lacks Testing step/Contract); unrelated to Assessment acceptance | `spine-tasks/SP-051-init-docs-rebrand/PROMPT.md` |
| Graphify post-commit hook rewrites `.spine/rules-manifest.json` | Restored via `git checkout` — engine-owned path, out of scope for this task | `.spine/rules-manifest.json` |
