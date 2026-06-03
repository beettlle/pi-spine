# SP-061: Code coverage 77% policy — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-03
**Review Level:** 2
**Review Counter:** 4
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read current `npm test` and CI workflow
- [x] Confirm no existing coverage tooling

---

### Step 1: Coverage tooling + npm scripts
**Status:** ✅ Complete

- [x] Add `test:coverage` script
- [x] Add threshold check failing below 77% line coverage
- [x] Document threshold constant (`scripts/coverage-policy.mjs`)

---

### Step 2: CI + spine-config defaults
**Status:** ✅ Complete

- [x] CI runs coverage check
- [x] `templates/spine-config.json` `testing.testWithCoverage` populated

---

### Step 3: Agent + skill policy text
**Status:** ✅ Complete

- [x] Worker template coverage standing order
- [x] Reviewer template coverage verification
- [x] create-spine-tasks skill + prompt template updated

---

### Step 4: PRD + verification
**Status:** ✅ Complete

- [x] PRD coverage requirement documented
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` green (376 pass)
- [x] Local coverage check passes at ≥77% (81.10% in-scope)

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 1 | plan | 1 | APPROVE | `.reviews/1-20260603T205346.md` |
| 2 | plan | 2 | APPROVE | `.reviews/2-20260603T205913.md` |
| 3 | code | 3 | APPROVE | `.reviews/3-20260603T210347.md` |
| 4 | code | 4 | APPROVE | `.reviews/4-20260603T211746.md` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-03 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-03 | Step 1 | Coverage scripts + npm scripts committed |
| 2026-06-03 | Step 2 | CI + spine-config template committed |
| 2026-06-03 | Step 3 | Agent + skill policy text committed |
| 2026-06-03 | Step 4 | PRD + verification committed |

---

## Blockers

*None*
