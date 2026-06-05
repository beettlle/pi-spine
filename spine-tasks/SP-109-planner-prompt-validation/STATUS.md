# SP-109: Fail-loud PROMPT validation — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-05
**Review Level:** 1
**Review Counter:** 1
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Reproduce: invalid PROMPT still appears in `spine plan` output
- [x] Read source audit report(s)
- [x] Dependencies satisfied

**Evidence:** Before fix, `spine plan` exit 0 with 117 tasks despite 69 invalid PROMPTs. After fix, `spine plan` exit 1 listing validation errors.

---

### Step 1: Shared validation gate
**Status:** ✅ Complete (review APPROVE)
- [x] Add `assertValidTaskPacket(packet, taskId)` helper used by planner load path
- [x] `buildPlan` throws/lists errors when `!packet.validation.ok`
- [x] `spine plan` exit 1 with error list
- [x] Call `spine_review_step` (plan)

---

### Step 2: Extend to preflight and rules CLI
**Status:** 🟡 In Progress
- [x] Preflight plan validation uses same helper (via `buildPlan`)
- [x] `spine rules select` uses validatePrompt not parsePrompt only
- [ ] Commit Step 2 + review

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started
- [x] Unit tests: invalid heading, missing testing step, bad file scope → plan fails
- [ ] FULL suite + coverage gate

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Note in operator runbook troubleshooting if needed

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `validate-prompt.mjs` listed in context but did not exist | Created shared helper module | `src/tasks/packet/validate-prompt.mjs` |
| Existing planner tests used minimal invalid PROMPT fixtures | Updated to `minimalValidPromptMarkdown` | `tests/planner/*`, `tests/config/env-overrides.test.mjs` |
| `spine plan all` fails when repo has invalid staged PROMPTs | Expected fail-loud behavior | operator runbook note pending |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-05 | Task staged from Phase 20 audit synthesis | PROMPT.md created |
| 2026-06-05 | Step 0 preflight | Reproduced SP-075 regression (69 invalid PROMPTs in plan) |
| 2026-06-05 | Step 1 implementation + review | APPROVE — shared validation gate in planner |
