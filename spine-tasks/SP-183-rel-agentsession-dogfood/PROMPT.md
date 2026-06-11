# Task: SP-183 — agentSession dogfood report

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Phase 22 reliability epic (SP-REL-013).
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Document stub-free agentSession batch sign-off.

**Source:** [docs/PRD-v2.1-reliability-handoff.md](../../docs/PRD-v2.1-reliability-handoff.md)

## Dependencies

- **Task:** SP-182

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.1-reliability-handoff.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/compatibility/agent-session-dogfood-report.md`
- `scripts/stub-free-dogfood.sh`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | — |
| fileScopeMustNotChange | — |

| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Read handoff entry for SP-183
- [ ] Dependencies satisfied

### Step 1: Implement

- [ ] Deliver mission scope for SP-183

### Step 2: Testing & Verification

- [ ] Run: `true`

- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update docs per scope
- [ ] Create `.DONE` when complete

## Completion Criteria

- [ ] All steps complete
- [ ] Handoff §4 acceptance for SP-183

## Git Commit Convention

- `feat(SP-183): complete Step N — description`

## Do NOT

- Expand scope beyond File Scope without replan
