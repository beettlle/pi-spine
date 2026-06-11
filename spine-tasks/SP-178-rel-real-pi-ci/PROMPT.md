# Task: SP-178 — Real-pi CI workflow

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Phase 22 reliability epic (SP-REL-008).
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Add .github/workflows/real-pi.yml (workflow_dispatch + weekly).

**Source:** [docs/PRD-v2.1-reliability-handoff.md](../../docs/PRD-v2.1-reliability-handoff.md)

## Dependencies

- **Task:** SP-172

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.1-reliability-handoff.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `.github/workflows/real-pi.yml`
- `docs/adoption/real-pi-e2e.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | see File Scope |
| fileScopeMustNotChange | — |
| minLineCoverage | 77 |
| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Read handoff entry for SP-178
- [ ] Dependencies satisfied

### Step 1: Implement

- [ ] Deliver mission scope for SP-178

### Step 2: Testing & Verification

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% on in-scope changed code
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update docs per scope
- [ ] Create `.DONE` when complete

## Completion Criteria

- [ ] All steps complete
- [ ] Handoff §4 acceptance for SP-178

## Git Commit Convention

- `feat(SP-178): complete Step N — description`

## Do NOT

- Expand scope beyond File Scope without replan
