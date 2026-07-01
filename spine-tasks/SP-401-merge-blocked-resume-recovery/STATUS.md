# SP-401: Merge blocked resume and wave skip recovery — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-01
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read issue #66 and recovery timeline
- [ ] Trace resume validation and wave loop

---

### Step 1: merge_blocked resume path
**Status:** ⬜ Not Started

- [ ] Allow `--force` resume from `merge_blocked` after orch resolution
- [ ] Diagnose `suggestedCommand` for merge_blocked

---

### Step 2: Skip succeeded waves on resume
**Status:** ⬜ Not Started

- [ ] Skip `executeResumeWave` for succeeded merges
- [ ] Advance `startWave` past terminal succeeded waves

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `tests/batch/merge-blocked-resume.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Operator runbook merge_blocked recovery
- [ ] Close issue #66
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-01 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
