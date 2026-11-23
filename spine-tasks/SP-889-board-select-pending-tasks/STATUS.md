# SP-889: Select pending tasks from GitHub label/milestone — Status

**Current Step:** Complete
**Status:** ✅ Complete — .DONE created
**Last Updated:** 2026-11-23
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-887 parser export API
- [x] Choose CLI surface on spine plan

---

### Step 1: Resolution + CLI
**Status:** ✅ Complete

- [x] Resolve issues for label/milestone
- [x] Match pending Mission-linked tasks
- [x] Print plan/batch-ready ID list
- [x] Non-goal: no auto batch start

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Operator + orchestrate docs
- [x] Resolution tests
- [x] Contract testCommand passing

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Must Update docs modified
- [x] Discoveries logged
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): bdb91b3  bin/spine-plan.mjs:133  WARNING  Inconsistent newline handling: the board-select path appends a trailing newline (output | advisory — noted, not blocking | contract review step |
| `bin/spine-cli/plan.mjs` `handlePlan` drops unknown flags (leaks flag value into scope string), so global `spine plan --github-label …` would misparse. That router shim is outside File Scope (FR-WORK-06) — documented surface is the direct entry `node bin/spine-plan.mjs --github-label …`. Follow-up (operator): forward argv from `handlePlan` to `bin/spine-plan.mjs` main to enable the global-router path. | Logged; follow-up suggested | STATUS, runbook §3 |
| `skills/spine-release-operator/SKILL.md` checked, not affected — it does its own `gh issue list` intake for packet authoring (issue → new packet), a different workflow from mapping already-staged packets to task IDs | Checked, no change | — |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-23 | Step 0 preflight | SP-887 parser API confirmed; CLI surface chosen (`bin/spine-plan.mjs` board flags); router gap logged |
| 2026-11-23 | Step 1 implementation | `src/cli/board-select.mjs` + `bin/spine-plan.mjs` wiring; 26 unit tests green |
| 2026-11-23 | Step 2 docs + verify | Runbook board-selection subsection; waves-doc + skill wave-picker note; CLI smoke with fake gh on PATH; Contract `testCommand` exit 0 (lint + typecheck + 27 tests) |
| 2026-11-23 | Step 3 delivery | Completion criteria verified; final Contract `testCommand` exit 0; `.DONE` created |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #382 child (#386). Depends on SP-887. Completes epic with siblings.
