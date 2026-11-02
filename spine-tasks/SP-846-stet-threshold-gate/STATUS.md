# SP-846: Stet contract script gates on severity and confidence thresholds — Status

**Current Step:** Done
**Status:** ✅ Complete
**Last Updated:** 2026-11-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read the upstream script; list the threshold pieces to port and the local pieces to keep (task-id scoping, git-dir baseline ref)
- [x] Run the existing test file once to record the baseline pass count

### Step 1: Threshold gate
**Status:** ✅ Complete

- [x] Severity validation (exit 2), confidence passed through to `stet list`
- [x] Gating list vs full list; failure message shows threshold, gating count, full list
- [x] Below-threshold stderr note; finish logic unchanged
- [x] `stet list --help` capability probe and all-findings fallback with stderr warning

### Step 2: Tests
**Status:** ✅ Complete

- [x] Mock stet: `list --help` with/without `--min-severity`; `list --min-severity …` returns the gating count
- [x] Threshold hit → exit 1, stderr names the threshold and shows the full list
- [x] Only sub-threshold findings → exit 0, below-threshold note, `stet finish` called (or not, under `SPINE_STET_NO_AUTO_FINISH=1`)
- [x] Old stet (no flag in help) → warning, any active finding exits 1
- [x] `SPINE_STET_MIN_SEVERITY=bogus` → exit 2 before `stet run`
- [x] Existing task-id and baseline tests still pass

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`
- [x] `bash -n scripts/spine-stet-contract-run.sh`
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Script header comment documents the gate policy, env overrides, and fallback
- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-846-stet-threshold-gate/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Upstream threshold logic: env defaults (`warning`/`0.8`), severity case → exit 2, `stet list --help` grep probe for `--min-severity`, gating list vs full list, gated failure msg + full triage list, below-threshold stderr note | Ported in Step 1 | upstream `beettlle/stet scripts/spine-stet-contract-run.sh` |
| Baseline test run: 15 tests pass, 0 fail (dot reporter) | Recorded | `tests/scripts/spine-stet-contract-run.test.mjs` |
| Test count grew 15 → 21 (6 new: threshold hit, sub-threshold ×2, old-stet ×2, bogus severity, env pass-through; threshold-hit folded into the existing findings test) | Done | `tests/scripts/spine-stet-contract-run.test.mjs` |
| First full Contract run had 2 flaky ENOTEMPTY failures: graphify background rebuild (fired by worker git commits) wrote `.git/ai/working_logs` in the tests' temp repos during cleanup; re-run green once rebuild settled | Environmental, no code change | Contract testCommand logs |
| `stet finish` failure message still says "zero-finding review"; semantically it now means "no threshold findings" — left unchanged per "finish logic unchanged" in PROMPT | Accepted | `scripts/spine-stet-contract-run.sh:163` |
| `scripts/worker-verify.sh` (full stub suite) has 62 pre-existing failures (3131/3193 pass) in spawn-heavy attached-batch/adoption tests; verified pre-existing: `tests/batch/batch-start-superseded-guard.test.mjs` (6/8) and `tests/batch/attached-batch-exit.test.mjs` (2/4) fail identically at lane base 1a20bcc8 with SP-846 absent | Pre-existing, out of SP-846 scope; Contract gate green | `/tmp/sp846-verify.log`, base worktree runs |
| `npm run typecheck` passes (worker-verify step 1); Contract testCommand passes end-to-end (exit 0): lint + 30 tests across the three contract files | Green | Contract gate |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
