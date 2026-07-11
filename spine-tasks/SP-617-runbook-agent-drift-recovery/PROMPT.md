# Task: SP-617 — Runbook agent drift recovery

**Created:** 2026-07-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Document agent-shell recovery for #196; docs-only after SP-613 lands the CLI path.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Document the **agent-safe** recovery path for `state_drift` after engine SIGTERM (issue #196): prefer detached resume/reconcile; never background `--attached`; after abort use salvage when lane commits exist; do not rely on `abort --dry-run` as a mutation probe.

**Source:** [`docs/PRD-v2.3.2-state-drift-recovery-handoff.md`](../../docs/PRD-v2.3.2-state-drift-recovery-handoff.md) §6 FR-REL232-05

## Dependencies

- **Task:** SP-613 (detached recovery command/path exists to document)

## Context to Read First

- [`docs/adoption/operator-runbook.md`](../../docs/adoption/operator-runbook.md)
- [`spine-tasks/SP-613-drift-detached-recover/PROMPT.md`](../SP-613-drift-detached-recover/PROMPT.md)
- GitHub [#196](https://github.com/beettlle/pi-spine/issues/196)

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

- [ ] Locate existing resume / state_drift / salvage / attached-shell sections in the runbook
- [ ] Confirm SP-613 suggestedCommand / recovery wording on main (or lane)

### Step 1: Add agent drift recovery section

- [ ] Add short runbook section for #196: diagnose → detached recovery → abort → salvage → manual FF only as last resort
- [ ] Cross-link #163/#185 detached-first policy
- [ ] Note abort `--dry-run` is read-only (SP-615)

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — agent-safe state_drift recovery

**Check If Affected:**
- None

## Completion Criteria

- [ ] Runbook documents agent-safe #196 recovery without `--attached`
- [ ] Salvage and dry-run notes present
- [ ] Docs-only contract satisfied

## Do NOT

- Change CLI/engine code (SP-613–615)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `docs(SP-617): runbook agent-safe state_drift recovery`
