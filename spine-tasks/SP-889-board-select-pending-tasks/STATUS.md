# SP-889: Select pending tasks from GitHub label/milestone — Status

**Current Step:** 2 (Testing & Verification)
**Status:** 🟡 Step 2 In Progress
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
**Status:** ⬜ Not Started

- [ ] Operator + orchestrate docs
- [ ] Resolution tests
- [ ] Contract testCommand passing

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Must Update docs modified
- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `bin/spine-cli/plan.mjs` `handlePlan` drops unknown flags (leaks flag value into scope string), so global `spine plan --github-label …` would misparse. That router shim is outside File Scope (FR-WORK-06) — documented surface is the direct entry `node bin/spine-plan.mjs --github-label …`. Follow-up (operator): forward argv from `handlePlan` to `bin/spine-plan.mjs` main to enable the global-router path. | Logged; follow-up suggested | STATUS, runbook §3 |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-23 | Step 0 preflight | SP-887 parser API confirmed; CLI surface chosen (`bin/spine-plan.mjs` board flags); router gap logged |
| 2026-11-23 | Step 1 implementation | `src/cli/board-select.mjs` + `bin/spine-plan.mjs` wiring; 26 unit tests green |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #382 child (#386). Depends on SP-887. Completes epic with siblings.
