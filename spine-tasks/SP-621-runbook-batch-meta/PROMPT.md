# Task: SP-621 — Runbook batch-meta recovery

**Created:** 2026-07-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only operator section after SP-620 lands the CLI path.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Document the operator path for **force-resume after abort limbo** using `batch-meta.json` (issue #126): locate runtime meta → `spine batch resume --force` → diagnose → integrate/salvage. Prefer detached resume; never background `--attached` (#163 / #185).

**Source:** [`docs/PRD-v2.4.0-recovery-batch-meta-handoff.md`](../../docs/PRD-v2.4.0-recovery-batch-meta-handoff.md) §6 FR-REL240-05

## Dependencies

- **Task:** SP-620 (reconstruct command/path exists to document)

## Context to Read First

- [`docs/adoption/operator-runbook.md`](../../docs/adoption/operator-runbook.md)
- [`spine-tasks/SP-620-batch-meta-reconstruct/PROMPT.md`](../SP-620-batch-meta-reconstruct/PROMPT.md)
- GitHub [#126](https://github.com/beettlle/pi-spine/issues/126)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Locate existing resume / abort / salvage / #196 sections in the runbook
- [ ] Confirm SP-620 reconstruct wording on main (or lane)

### Step 1: Add batch-meta force-resume section

- [ ] Add short section for #126: abort limbo → batch-meta → detached `resume --force` → diagnose
- [ ] Cross-link #163/#185 detached-first and #196 drift recovery where relevant
- [ ] Note fail-closed behavior when meta missing

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — batch-meta force-resume recovery

**Check If Affected:**
- None

## Completion Criteria

- [ ] Runbook documents #126 force-resume from batch-meta without `--attached`
- [ ] Docs-only contract satisfied

## Do NOT

- Change CLI/engine code (SP-619–620)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `docs(SP-621): runbook batch-meta force-resume recovery`
