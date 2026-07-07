# Task: SP-534 — Harness detached policy docs

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only update for detached-first batch policy in operator skills.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-26: update `spine-autonomous-operator` and `spine-release-operator` skills to prefer **detached** batch resume/start from short-lived agent shells ([#185](https://github.com/beettlle/pi-spine/issues/185)). Document MonitorCreate / `spine wait` patterns; demote `--attached` to persistent interactive terminals only.

**Closes:** [#185](https://github.com/beettlle/pi-spine/issues/185)

## Dependencies

- **Task:** SP-530 (release-operator skill baseline for v1.10.0 harness)
- **Task:** SP-531 (release-operator skill — serialize to avoid scope overlap)

## Context to Read First

- [`docs/PRD-v1.10.0-release-harness-handoff.md`](../../docs/PRD-v1.10.0-release-harness-handoff.md) §FR-STA-26
- [`skills/spine-autonomous-operator/references/agent-shell-batch-policy.md`](../../skills/spine-autonomous-operator/references/agent-shell-batch-policy.md)
- [`skills/spine-release-operator/references/pi-async-orchestration.md`](../../skills/spine-release-operator/references/pi-async-orchestration.md)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/spine-autonomous-operator/SKILL.md`
- `skills/spine-autonomous-operator/references/agent-shell-batch-policy.md`
- `skills/spine-release-operator/SKILL.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/spine-autonomous-operator/SKILL.md`, `skills/spine-release-operator/SKILL.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Read issue #185 and #163 (attached orphan context)
- [ ] Audit current `--attached` guidance in both skills

### Step 1: Detached-first policy

- [ ] autonomous-operator: default detached + MonitorCreate / `spine wait`; `--attached` only for persistent human terminal
- [ ] release-operator Phase 4: reinforce detached start; link agent-shell-batch-policy
- [ ] operator-runbook: add short detached-first callout if missing

### Step 2: Testing & Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Comment on #185
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Both operator skills document detached-first policy
- [ ] `--attached` explicitly restricted to persistent interactive shells

## Do NOT

- Change engine detached spawn implementation
- Remove `--attached` support entirely

## Git Commit Convention

- `docs(SP-534): detached-first policy in operator skills`
