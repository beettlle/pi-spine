# SP-792: Abort, complete and dismiss archive in-lock state — Status

**Current Step:** Step 5 — Documentation & Delivery
**Status:** 🟨 In Progress
**Last Updated:** 2026-09-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Pre-lock snapshot uses listed
- [x] Line counts noted
- [x] Dependencies satisfied

### Step 1: Abort in-lock reload
**Status:** ✅ Complete

- [x] Reload + mismatch fail-closed
- [x] Snapshot from in-lock state

### Step 2: Complete + dismiss in-lock reload
**Status:** ✅ Complete

- [x] Reload + precondition re-validated
- [x] Archive/history/clear from in-lock state
- [x] `lifecycle.mjs` ≤ 500 lines (494)

### Step 3: Tests
**Status:** ✅ Complete

- [x] Abort stale-snapshot (12/12 pass in `tests/batch/abort.test.mjs`)
- [x] Complete/dismiss stale-snapshot (8/8 pass in `tests/batch/lifecycle.test.mjs`)
- [x] Batch-id changed (abort + complete; abort also covers vanished-file ENOENT, dismiss covers phase-flip + --force)

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint — `npm run lint` clean (eslint --max-warnings 0)
- [x] Contract `testCommand` — 39/39 pass with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER` (see Discovery 4)
- [x] Batch suite — `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`: 1574/1574 pass
- [x] Coverage gate — `npm run coverage:check`: 89.99% line (threshold 77%), suite 2734/2734 pass
- [x] Fix all failures — none in scope; one apparent failure was worker-env leakage (Discovery 4), plus one flaky ENOTEMPTY tmpdir-cleanup race in lifecycle.test.mjs that passes on re-run

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Pre-lock `loaded.raw` uses inside lock sections: `abort.mjs` — `buildAbortedSnapshot(loaded.raw)` L227, `clearActiveBatchState(loaded.path)` L300; `lifecycle.mjs` dismiss — archive L214, postMortem L217, metric L240, cleanup L247, clear L248; complete — archive L420, postMortem L423, metric L446, cleanup L453, clear L454. Baseline line counts: `lifecycle.mjs` 469/500, `abort.mjs` 301. |
| 2 | `reconcileBatch` is called with in-memory `batchState` (no re-read), so an in-lock reload of the state file is the only fresh read — no double-count risk in tests. |
| 3 | Shared reload helper `reloadStateForTerminalWrite` extracted into `src/batch/lifecycle-archive.mjs` (PROMPT Step 2 permits this to keep `lifecycle.mjs` ≤ 500 lines). File Scope addition per PROMPT. |
| 4 | Env sensitivity: `tests/batch/batch-state-handoff.test.mjs` "startBatch refuses with skipPreflight when spine state is corrupt" fails only when `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` are set alongside `SPINE_WORKER_STUB=1` (verified pre-existing at lane base 979278fa with identical failure; passes with worker env unset per PROMPT Environment). Touches `startBatch`/doctor paths outside SP-792 File Scope — reported, not fixed. |
| 5 | `gitnexus detect_changes` post-change: risk low; `archiveBatchStatePath` flows unchanged. An auto-regenerated `.spine/rules-manifest.json` timestamp from spine tooling was reverted (Do-NOT path). |
| 6 | Runbook §6 (operator-runbook) reviewed — no operator-visible command/behavior change (fail-closed mismatch surfaces as a non-ok result with `spine status --diagnose`); no doc update required (Must Update: None / SP-803). |

## Blockers

_None._
