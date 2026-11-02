# Task: SP-846 — Stet contract script gates on severity and confidence thresholds

**Created:** 2026-11-01
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** The script is the stet gate for every stet-reviewed lane. Too loose lets real defects through; a broken fallback could pass lanes silently when stet is old.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `scripts/spine-stet-contract-run.sh` (lines ~83-105) counts every line of `stet list` and fails on any active finding, including low-confidence `info`/`nitpick` noise. stet v1.4.0 (2026-11-01, stet #37) added `stet list --min-severity <error|warning|info|nitpick>` and `--min-confidence <0..1>`; findings below the threshold are hidden but stay active. Upstream stet's own copy of this script (`beettlle/stet` `scripts/spine-stet-contract-run.sh`) now gates on `warning` / `0.8` with env overrides and falls back to all active findings when `stet list --help` lacks `--min-severity`. Our copy has task-id scoping and a git-dir baseline-ref fallback that upstream lacks — keep both.

## Mission

`scripts/spine-stet-contract-run.sh` fails the contract only on findings at or above a severity/confidence threshold:

1. **Threshold** — `SPINE_STET_MIN_SEVERITY` (default `warning`; one of `error|warning|info|nitpick`, anything else exits 2 before touching stet) and `SPINE_STET_MIN_CONFIDENCE` (default `0.8`; validated by `stet list`, whose non-zero exit fails the script with exit 1).
2. **Gate** — the gating count comes from `stet list --min-severity "$min_severity" --min-confidence "$min_confidence"`. On failure, stderr shows the threshold, the gating count, and the full unfiltered `stet list` for triage, followed by the existing triage instructions.
3. **Below threshold** — when only sub-threshold findings remain, print `stet: N finding(s) below the <sev>/<conf> threshold did not block this lane` to stderr and continue to the existing finish / `SPINE_STET_NO_AUTO_FINISH` logic.
4. **Old stet fallback** — when `stet list --help` does not mention `--min-severity`, warn on stderr and gate on all active findings (current behavior). Never pass silently.
5. **Unchanged** — strictness argument, `[task-id]` scoping, baseline-ref fallback, `stet run` failure handling, and the triage text.

## Dependencies

- **None**

## Context to Read First

- `scripts/spine-stet-contract-run.sh` (whole file, 115 lines)
- `tests/scripts/spine-stet-contract-run.test.mjs` 1-120 (mock stet: `writeMockStet` state files, `list` case)
- Upstream reference: `gh api repos/beettlle/stet/contents/scripts/spine-stet-contract-run.sh -q .content | base64 -d` (port the threshold logic only)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (tests use a mock `stet` on `PATH`)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `scripts/spine-stet-contract-run.sh`
- `tests/scripts/spine-stet-contract-run.test.mjs` — 462 lines; extend `writeMockStet` (a `listHelp` flag and a `gating` count served when `--min-severity` is passed) rather than duplicating it

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/scripts/spine-stet-contract-run.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| fileScopeMustChange | `scripts/spine-stet-contract-run.sh`, `tests/scripts/spine-stet-contract-run.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Read the upstream script; list the threshold pieces to port and the local pieces to keep (task-id scoping, git-dir baseline ref)
- [ ] Run the existing test file once to record the baseline pass count

### Step 1: Threshold gate

- [ ] Severity validation (exit 2), confidence passed through to `stet list`
- [ ] Gating list vs full list; failure message shows threshold, gating count, full list
- [ ] Below-threshold stderr note; finish logic unchanged
- [ ] `stet list --help` capability probe and all-findings fallback with stderr warning

**Artifacts:**
- `scripts/spine-stet-contract-run.sh` (modified)

### Step 2: Tests

- [ ] Mock stet: `list --help` with/without `--min-severity`; `list --min-severity …` returns the gating count
- [ ] Threshold hit → exit 1, stderr names the threshold and shows the full list
- [ ] Only sub-threshold findings → exit 0, below-threshold note, `stet finish` called (or not, under `SPINE_STET_NO_AUTO_FINISH=1`)
- [ ] Old stet (no flag in help) → warning, any active finding exits 1
- [ ] `SPINE_STET_MIN_SEVERITY=bogus` → exit 2 before `stet run`
- [ ] Existing task-id and baseline tests still pass

**Artifacts:**
- `tests/scripts/spine-stet-contract-run.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`
- [ ] `bash -n scripts/spine-stet-contract-run.sh`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Script header comment documents the gate policy, env overrides, and fallback
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-846-stet-threshold-gate/.DONE`

## Documentation Requirements

**Must Update:**
- `scripts/spine-stet-contract-run.sh` — header comment (gate policy)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §8.1 (SP-847 owns this edit)

## Completion Criteria

- [ ] Contract fails only on findings at or above the threshold; sub-threshold findings never block
- [ ] Old stet falls back to gating on every active finding with a warning
- [ ] Task-id scoping and baseline-ref fallback unchanged

## Git Commit Convention

- `feat(SP-846): stet contract script gates on severity/confidence thresholds`

## Do NOT

- Drop the `[task-id]` argument or the git-dir baseline-ref fallback
- Use `stet status` for counting (it includes dismissed findings)
- Add `--auto-finish-zero` or retries
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
