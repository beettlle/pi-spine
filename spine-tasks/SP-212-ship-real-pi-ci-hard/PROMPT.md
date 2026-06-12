# Task: SP-212 — Real-pi CI blocking hardening

**Created:** 2026-06-12
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Workflow posture change; fails CI when pi present and E2E fails.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-212-ship-real-pi-ci-hard/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-03: When `pi` is on the CI runner and `./scripts/real-pi-adoption-e2e.sh --batch` fails, workflow **must fail** (remove advisory-only `continue-on-error`). When `pi` absent, document skip with explicit message.

## Dependencies

- **Task:** SP-206

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-03
- `.github/workflows/real-pi.yml`
- `scripts/real-pi-adoption-e2e.sh`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `.github/workflows/real-pi.yml`
- `scripts/real-pi-adoption-e2e.sh`
- `docs/adoption/operator-runbook.md`
- `docs/adoption/real-pi-e2e.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `.github/workflows/real-pi.yml` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read current real-pi.yml continue-on-error posture
- [ ] Confirm SP-206 CI trust landed

### Step 1: Blocking workflow
> **Plan-review checkpoint**


- [ ] Remove advisory-only failure posture when pi detected
- [ ] Preserve skip path when pi absent with logged message
- [ ] Update runbook CI expectations section

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77%
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Runbook § real-pi CI expectations
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Workflow fails when pi present and E2E fails
- [ ] Skip documented when pi absent
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-212): complete Step N — description`
- `fix(SP-212): description`
- `test(SP-212): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests
- Load docs not listed in Context to Read First

---

## Amendments (Added During Execution)
