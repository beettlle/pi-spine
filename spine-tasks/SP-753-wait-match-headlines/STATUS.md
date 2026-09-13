# SP-753: wait human match/timeout headlines — Status

**Current Step:** 1 (Human terminal headlines)
**Status:** 🟣 In Progress
**Last Updated:** 2026-09-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm human-mode match path returns without `writeStdout` today — confirmed: match/timeout branches guard stdout writes behind `if (json)`; human mode returns silently. Interrupt path (exit 130) emits nothing in any mode.
- [x] Confirm supersede already has a human headline on stderr — confirmed: `formatSupersededHeadline` → `writeStderr` in non-json branch.
- [x] Dependencies satisfied — none declared.

---

### Step 1: Human terminal headlines
**Status:** ✅ Complete

> **Plan (Review Level 1):** In `src/cli/wait.mjs` add module-local helpers `formatWaitElapsed(ms)` (human duration `12.0s`/`1m5s`) and `describeMatchedDiagnosis(result, until)` (literal diagnosis when taxonomy-matched, else first matching pseudo diagnosis via `deriveWaitPseudoDiagnoses`). Match branch (non-json): one stdout line `Wait matched: <diagnosis> (batch <id>) after <elapsed>` — omit batch segment when no scoped id. Timeout branch (non-json): one stderr line `Wait timed out after <elapsed> waiting for <until list> (last diagnosis: <x>)`. Interrupt path (non-json): one stderr line before returning 130. `--json` paths untouched. Tests: human match (1 stdout line w/ diagnosis+batchId+elapsed), human timeout (1 stderr line, stdout empty), interrupt via `process.emit("SIGINT")` in `sleepFn` (exit 130 + headline), json single-snapshot preserved.

- [x] On match (non-json): write one stdout line including diagnosis, scoped batchId, and elapsed when available — also covers phase-based `failed` alias (#252) and pseudo diagnoses (gate_open) in the label; batch segment omitted when no scoped id
- [x] On timeout (non-json): write one stdout or stderr line distinguishing timeout from match — stderr `Wait timed out after <elapsed> waiting for <until> (batch <id>) — last diagnosis: <x>`
- [x] On interrupt (SIGINT path): write one human line when not json (if reachable in tests) — reachable via `process.emit("SIGINT")` in `sleepFn`; exit 130 + stderr headline; json stays silent
- [x] Preserve `--json` single-snapshot stdout on match/timeout — untouched; json interrupt/supersede output unchanged
- [x] Unit tests: stub reconcile that matches / times out; assert `writeStdout`/`writeStderr` called in human mode — 6 new tests, all pass

**Artifacts:**
- `src/cli/wait.mjs` (modified)
- `tests/cli/wait.test.mjs` (modified)

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
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
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |
| 2026-09-13 | Step 0 preflight | Confirmed silent human match/timeout/interrupt; supersede stderr headline exists; deps none |
| 2026-09-13 | Step 1 implemented | Headlines for match/timeout/interrupt + 6 unit tests; scoped suite 30/30 pass |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
