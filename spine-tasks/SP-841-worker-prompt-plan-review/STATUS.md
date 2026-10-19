# SP-841: Stop telling workers to run per-step plan review — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] `rg -n 'plan review only|type=plan|--type plan' src templates tests` — record every hit in Discoveries

### Step 1: Prompt + template
**Status:** ✅ Complete

- [x] Hint and template wording updated

### Step 2: Tests
**Status:** ✅ Complete

- [x] Old-string assertions replaced with new-wording assertions

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand` (ends with the stet review)
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-841-worker-prompt-plan-review/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Hits for old strings: `src/batch/worker-prompt.mjs:16`; `templates/agents/worker.md` 56, 73, 84; `tests/batch/worker-prompt.test.mjs` 18-19; `tests/agents/template-drift.test.mjs` 48 (`spine review step`) | Fixed | src, templates, tests |
| Stet findings ad3236c (`src/metrics/quota-cli.mjs`) and 33e9ca0 (`tests/metrics/quota-probes.test.mjs`) concern SP-839 files outside this diff | Dismissed out_of_scope | stet |
| `docs/QUICK-REFERENCE.md` has no old plan-review wording | No change | docs |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
| 2026-10-19 | Steps 0-4 done; lint, typecheck, targeted tests, stet (0 findings) pass | .DONE created |
