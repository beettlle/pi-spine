# Task: SP-066 — Supervisor v1 stub

**Created:** 2026-06-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Documentation-only replacement of supervisor placeholder — honest v1 guidance, no runtime supervisor agent.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Replace the placeholder comment in `templates/agents/supervisor.md` with honest **v1 guidance**: pi-spine does **not** spawn a supervisor agent session in v1. Operators use `spine status --diagnose`, the batch journal, and the dashboard for orchestration visibility. Document optional project overrides via `.spine/agents/supervisor.md` and **mutual exclusion** with Taskplane `/orch` — do not run both orchestrators on the same repo.

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- `templates/agents/supervisor.md` (current placeholder)
- `docs/adoption/operator-runbook.md` — diagnose / dashboard workflows
- `docs/PRD.md` — supervisor scope (if any)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/agents/supervisor.md`

## Steps

### Step 0: Preflight

- [ ] Read operator runbook diagnose and journal sections
- [ ] Confirm no v1 supervisor agent spawn in codebase (grep `supervisor` in `src/batch/`)

### Step 1: Write v1 supervisor guidance

> **Plan-review checkpoint**

- [ ] Replace `<!-- Customize supervisor instructions -->` with structured sections:
  - **v1 reality:** no supervisor Pi agent session; human operator + CLI/dashboard
  - **Operator tools:** `spine status --diagnose`, batch journal paths, dashboard URL/pattern
  - **Project overrides:** optional `.spine/agents/supervisor.md` for future use / notes (not auto-spawned in v1)
  - **Taskplane exclusion:** do not use Taskplane `/orch` alongside spine batch on same tasks root

**Artifacts:**
- `templates/agents/supervisor.md` (modified)

### Step 2: Testing & Verification

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Template renders valid markdown (headings, no broken frontmatter)

## Documentation Requirements

**Must Update:**
- `templates/agents/supervisor.md`

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — link only if obviously missing (minimal)

## Completion Criteria

- [ ] Supervisor template documents v1 no-agent behavior and operator tooling
- [ ] Taskplane `/orch` mutual exclusion stated
- [ ] Full test suite green

## Git Commit Convention

- **Step completion:** `feat(SP-066): complete Step N — description`

## Do NOT

- Implement a supervisor agent runtime
- Expand scope beyond `templates/agents/supervisor.md`

## Amendments

_(Workers only.)_
