# SP-240: Journal rebuild incident fixtures — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-14
**Review Level:** 2
**Review Counter:** 1
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Review SP-221 structural rebuild implementation
- [x] Select incident fixtures to cover

**Selected fixtures:** `retry-clears-failed-classification`, `resume-parallel-lane-orphan`, `orphan-running-resume`, `pidless-ghost-running`, `resume-orphan-historical-failure` (5 of 6 — `lane-worktree-devcontainer` lacks structural journal events; covered by diagnosis tests).

---

### Step 1: Fixtures and docs
**Status:** ✅ Complete

- [x] Add incident fixture regression tests
- [x] Document limitations vs Babysitter replay in runbook
- [x] Call `spine_review_step` after this step

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] FULL test suite passing
- [x] Coverage gate passes (when applicable)
- [x] All failures fixed

**Verification:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — 838 pass when `SPINE_WORKER_PI_TIMEOUT_MS` is unset (pi harness sets 7200000 in worker sessions; pre-existing env pollution, not SP-240). `npm run coverage:check` — 86.49% line (threshold 77%).

---

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress

- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 1 | plan | 1 | APPROVE | `.reviews/1-20260614T212417.md` |

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `lane-worktree-devcontainer.json` uses `journalEvents` not `journalTail` and has no structural events | Out of scope for rebuild regression | `tests/fixtures/incidents/README.md` |
| Pi worker session exports `SPINE_WORKER_PI_TIMEOUT_MS=7200000`, breaking 2 timeout tests if unset | Pre-existing harness env; not SP-240 scope | worker-pi-timeout.test.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-12 | Task staged | PROMPT.md and STATUS.md created (size decomposition) |
| 2026-06-14 | Step 0 preflight | SP-221 `deriveStructuralBatchStateFromJournal` reviewed; 5 fixtures selected |
| 2026-06-14 | Step 1 | Added `journal-rebuild-incidents.test.mjs` (8 tests); runbook Babysitter limitations section |
| 2026-06-14 | Plan review step 1 | APPROVE (stub) |
| 2026-06-14 | Step 2 | typecheck + 838 tests pass; coverage 86.49% |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
