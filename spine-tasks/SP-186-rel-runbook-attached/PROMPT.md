# Task: SP-186 — Attached-first runbook

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Phase 22 reliability epic (SP-REL-016).
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Operator runbook attached-first policy and orphan recovery tree.

**Source:** [docs/PRD-v2.1-reliability-handoff.md](../../docs/PRD-v2.1-reliability-handoff.md)

## Dependencies

- **Task:** SP-185

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.1-reliability-handoff.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `README.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | — |
| fileScopeMustNotChange | — |

| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Read handoff entry for SP-186
- [ ] Dependencies satisfied

### Step 1: Implement

- [ ] Deliver mission scope for SP-186

### Step 2: Testing & Verification

- [ ] Run: `true`

- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update docs per scope
- [ ] Create `.DONE` when complete

## Completion Criteria

- [ ] All steps complete
- [ ] Handoff §4 acceptance for SP-186

## Git Commit Convention

- `feat(SP-186): complete Step N — description`

## Do NOT

- Expand scope beyond File Scope without replan
