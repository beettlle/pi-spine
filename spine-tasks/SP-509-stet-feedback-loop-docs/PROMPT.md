# Task: SP-509 — Stet feedback loop documentation (P0)

**Created:** 2026-07-06
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Docs-only landing of the v1.5.0 stet audit from PR #172. Explains why `.review/history.jsonl` is absent and documents operator triage/optimize cadence. No runtime or contract script changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-509-stet-feedback-loop-docs/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Land the stet feedback-loop feature brief and cross-links so operators understand that zero-finding contract runs with `--auto-finish-zero` do **not** create `.review/history.jsonl`, and know how to triage dismissals so `stet optimize` has input when findings exist.

Source: [PR #172](https://github.com/beettlle/pi-spine/pull/172) commit `f7c7aa4` (docs-only; runtime fixes from that PR are already on `main`).

## Dependencies

- **Task:** SP-494 (stet Option A bootstrap — complete)

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/CONTEXT.md` — Phase 58 stet policy
- `docs/stet-overview.md` — Option A integration

**Tier 3 (load only if needed):**
- PR #172 diff for `docs/features/stet-feedback-loop-brief.md`
- `.cursor/rules/stet-integration.mdc`

## Environment

- **Workspace:** `docs/`
- **Services required:** None

## File Scope

- `docs/features/stet-feedback-loop-brief.md`
- `docs/stet-overview.md`
- `docs/adoption/operator-runbook.md`
- `.cursor/rules/stet-integration.mdc`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && spine tasks validate SP-509` |
| fileScopeMustChange | `docs/features/stet-feedback-loop-brief.md` |
| artifactsMustExist | `docs/features/stet-feedback-loop-brief.md` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read PR #172 body and brief content on branch `docs/stet-feedback-loop-brief`
- [ ] Confirm SP-494 bootstrap artifacts exist (`.review/config.toml`, `scripts/spine-stet-contract-run.sh`)
- [ ] Dependencies satisfied

### Step 1: Add feature brief

- [ ] Create `docs/features/stet-feedback-loop-brief.md` (audit record, state artifacts table, history.jsonl explanation, P0–P2 proposals)
- [ ] Include mermaid flowchart for zero-finding auto-finish path

**Artifacts:**
- `docs/features/stet-feedback-loop-brief.md`

### Step 2: Cross-link operator docs

- [ ] `docs/stet-overview.md` — add "State & feedback loop" subsection linking to brief
- [ ] `docs/adoption/operator-runbook.md` §8.1 — when `history.jsonl` appears, triage + `stet optimize` cadence
- [ ] `.cursor/rules/stet-integration.mdc` — "When history.jsonl is missing" note
- [ ] `spine-tasks/CONTEXT.md` — pointer under stet policy

**Artifacts:**
- `docs/stet-overview.md`, `docs/adoption/operator-runbook.md`, `.cursor/rules/stet-integration.mdc`, `spine-tasks/CONTEXT.md`

### Step 3: Testing & Verification

- [ ] Internal markdown links resolve (manual check)
- [ ] `npm run typecheck`
- [ ] `spine tasks validate SP-509`
- [ ] Confirm no runtime files changed

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Close PR #172 with comment referencing SP-509 (or note cherry-pick)

## Documentation Requirements

**Must Update:**
- `docs/features/stet-feedback-loop-brief.md`
- `docs/stet-overview.md`
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `.cursor/rules/stet-integration.mdc`
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Brief documents why `history.jsonl` is absent after zero-finding batches
- [ ] Operator runbook documents triage before auto-finish when findings exist

## Git Commit Convention

- **Step completion:** `docs(SP-509): complete Step N — description`
- **Bug fixes:** `fix(SP-509): description`

## Do NOT

- Modify `scripts/spine-stet-contract-run.sh` (SP-510 scope)
- Change `.spine/spine-config.json` or stet hooks
- Commit `.review/history.jsonl` or session state
- Expand scope to gate-level stet (#160)

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
