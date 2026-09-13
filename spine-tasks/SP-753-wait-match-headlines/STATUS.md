# SP-753: wait human match/timeout headlines — Status

**Current Step:** 3 (Documentation & Delivery) — all steps complete
**Status:** ✅ Complete
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
**Status:** ✅ Complete

- [x] Run lint: `npm run lint` — clean (eslint --max-warnings 0)
- [x] Run Contract `testCommand` — lint clean, typecheck clean, scoped wait suite 30/30 pass (re-run fresh in re-entry session: 2026-09-13)
- [x] Fix all failures — none in scope. Full `npm test` re-run in re-entry session: 2574/2618 pass; 44 failures all pre-existing environmental (batch-engine tests hitting `Nested batch start blocked: SPINE_IS_WORKER=1`, SP-482). Regression-free proof: none of the 24 failing test files import `cli/wait`, and task commits touch only `src/cli/wait.mjs`, `tests/cli/wait.test.mjs`, STATUS/PROMPT. Coverage: `src/cli/wait.mjs` line coverage 97.15% (min 77) via c8 on the scoped suite (prior run, identical code).

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md — see Discoveries table
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Human-mode match/timeout/interrupt were fully silent; only `--json` emitted output; supersede already had a stderr headline (#215) | Confirmed in Step 0 preflight | `src/cli/wait.mjs` |
| Match can fire via pseudo diagnoses (`gate_open`) or the phase-based `failed` alias (#252), so the headline label resolves what actually matched, not the raw diagnosis | Handled by `describeMatchedDiagnosis` helper | `src/cli/wait.mjs` |
| Interrupt (exit 130) is test-reachable via `process.emit("SIGINT")` inside `sleepFn` — no real signal needed | Used in two new tests | `tests/cli/wait.test.mjs` |
| `tests/spine-run.test.mjs` and ~41 batch-spawn tests cannot pass inside worker sessions (`SPINE_IS_WORKER=1` nested-batch guard, SP-482); they don't unset the env var before spawning real engines | Pre-existing environmental, out of scope; documented here | `tests/spine-run.test.mjs`, `tests/batch/*` |
| Test runs regenerate `.spine/rules-manifest.json` `generatedAt` and rotate tracked `coverage/tmp/*.json`; both restored to committed state after runs | Kept worktree clean | `.spine/rules-manifest.json`, `coverage/tmp/` |
| `docs/adoption/operator-runbook.md` wait sections document usage/flags/process cost, not terminal output — headlines do not invalidate them; doc updates deferred to SP-756 per PROMPT | No change needed | `docs/adoption/operator-runbook.md` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |
| 2026-09-13 | Step 0 preflight | Confirmed silent human match/timeout/interrupt; supersede stderr headline exists; deps none |
| 2026-09-13 | Step 1 implemented | Headlines for match/timeout/interrupt + 6 unit tests; scoped suite 30/30 pass |
| 2026-09-13 | Step 2 verification | Contract testCommand green (lint+typecheck+30/30); coverage 97.15% ≥ 77; full suite 2575/2618 with 43 pre-existing env failures |
| 2026-09-13 | Step 3 delivery | Discoveries logged; .DONE claimed but not persisted (session interrupted) |
| 2026-09-13 | Re-entry verification | Fresh foreground runs at HEAD d04b68c9: Contract testCommand green (lint+typecheck+30/30); full suite 2574/2618 with 44 env-class failures (none touch wait scope); worktree cleaned; .DONE created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
