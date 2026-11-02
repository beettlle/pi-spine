# SP-846: Stet contract script gates on severity and confidence thresholds — Status

**Current Step:** Step 3
**Status:** 🟡 In Progress
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
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`
- [ ] `bash -n scripts/spine-stet-contract-run.sh`
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Script header comment documents the gate policy, env overrides, and fallback
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-846-stet-threshold-gate/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Upstream threshold logic: env defaults (`warning`/`0.8`), severity case → exit 2, `stet list --help` grep probe for `--min-severity`, gating list vs full list, gated failure msg + full triage list, below-threshold stderr note | Ported in Step 1 | upstream `beettlle/stet scripts/spine-stet-contract-run.sh` |
| Baseline test run: 15 tests pass, 0 fail (dot reporter) | Recorded | `tests/scripts/spine-stet-contract-run.test.mjs` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
