# SP-846: Stet contract script gates on severity and confidence thresholds — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-11-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read the upstream script; list the threshold pieces to port and the local pieces to keep (task-id scoping, git-dir baseline ref)
- [ ] Run the existing test file once to record the baseline pass count

### Step 1: Threshold gate
**Status:** ⬜ Not Started

- [ ] Severity validation (exit 2), confidence passed through to `stet list`
- [ ] Gating list vs full list; failure message shows threshold, gating count, full list
- [ ] Below-threshold stderr note; finish logic unchanged
- [ ] `stet list --help` capability probe and all-findings fallback with stderr warning

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Mock stet: `list --help` with/without `--min-severity`; `list --min-severity …` returns the gating count
- [ ] Threshold hit → exit 1, stderr names the threshold and shows the full list
- [ ] Only sub-threshold findings → exit 0, below-threshold note, `stet finish` called (or not, under `SPINE_STET_NO_AUTO_FINISH=1`)
- [ ] Old stet (no flag in help) → warning, any active finding exits 1
- [ ] `SPINE_STET_MIN_SEVERITY=bogus` → exit 2 before `stet run`
- [ ] Existing task-id and baseline tests still pass

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

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
