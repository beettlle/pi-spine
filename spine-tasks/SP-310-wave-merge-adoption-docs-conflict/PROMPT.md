# Task: SP-310 — Wave merge adoption docs conflict resolution

**Created:** 2026-06-19
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Batch merge reliability — serial README wave tasks overlap `docs/adoption/operator-runbook.md`; wave 3 merge fails after both tasks succeed.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #14**: batch `20260619T020951` wave 3 merge failed on `docs/adoption/operator-runbook.md` after SP-303 and SP-304 both succeeded. Operator recovery required `batch force-merge --wave 3` plus `resume --force`; wave 3 merge record missing from `mergeResults` (only wave 4 merge landed on orch).

**Required behavior:**
1. Detect additive conflicts in `docs/adoption/*` when serial lane tasks touch sections already modified on orch (table rows, cross-links) and auto-resolve when both sides are non-destructive.
2. When auto-resolution is unsafe, fail with actionable `lastError` naming conflicting hunks and suggested operator commands (`force-merge`, manual merge path).
3. Record wave merge outcome in `mergeResults` even when `forceMergedWaves` is set — no silent skip of wave index.
4. Regression test: two serial tasks modify disjoint sections of `operator-runbook.md` → wave merge succeeds without `force-merge`.

**Closes:** [#14](https://github.com/beettlle/pi-spine/issues/14)

## Dependencies

- **Task:** SP-305

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `spine-tasks/SP-303-readme-doc-absorption/PROMPT.md`
- `spine-tasks/SP-304-readme-doc-index-sync/PROMPT.md`
- `src/batch/engine-scope.mjs` — `forceMergeWave`, merge eligibility
- `src/batch/merge/` (wave merge and conflict resolution)
- GitHub issue #14; archived batch `.spine/runtime/20260619T020951/archive/batch-state.json`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/engine-scope.mjs`
- `src/batch/merge/` (or equivalent wave merge modules)
- `tests/batch/` (adoption doc merge regression)
- `docs/adoption/operator-runbook.md` (runbook merge-recovery section only if behavior changes)

## Contract

| Field | Value |
|-------|-------|
| `fileScopeMustChange` | `src/batch/` |
| `testsRequired` | yes |
| `coverageGate` | yes |

## Steps

### Step 0: Preflight

- [ ] Reconstruct wave 3 failure from issue #14 and archived batch state
- [ ] Identify merge module handling `operator-runbook.md` conflict
- [ ] Confirm current auto-resolution paths (rules-manifest, dependency drift)

### Step 1: Implement adoption-doc merge resolution

- [ ] Add safe auto-merge for additive `docs/adoption/*` hunks when serial lane commits touch non-overlapping sections
- [ ] Ensure `forceMergedWaves` still produces a `mergeResults` entry for the wave index
- [ ] Improve `lastError` message with file path and recovery commands

### Step 2: Testing & Verification

- [ ] Add regression test for serial wave merge on `operator-runbook.md`
- [ ] Run full test suite (`npm test`)
- [ ] Coverage gate passing

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook merge recovery notes if behavior changed
- [ ] Close issue #14 (`gh issue close 14`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Wave 3-style adoption doc merge conflict auto-resolves or fails with actionable error
- [ ] `mergeResults` records every merged wave index
- [ ] Tests pass with coverage gate
- [ ] Issue #14 closed

## Git Commit Convention

`feat(SP-310): <short description>` or `fix(SP-310): <short description>`

## Do NOT

- Broaden auto-merge to arbitrary paths outside `docs/adoption/*` without tests
- Silence merge failures without recording wave outcome
- Modify unrelated README content from SP-300–305 scope

---

## Amendments (Added During Execution)
