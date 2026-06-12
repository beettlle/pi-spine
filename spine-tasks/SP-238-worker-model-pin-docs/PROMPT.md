# Task: SP-238 — Worker model pin template and runbook

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Template defaults, runbook LM Studio note, optional doctor warning for inherit.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-238-worker-model-pin-docs/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Document and default spine-config model pins after SP-232 worker argv fix. Update greenfield template to recommend `cursor/auto`; document `inherit` opt-in; optional doctor warning when inherit + pi-lmstudio detected.

## Dependencies

- **Task:** SP-232

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `templates/spine-config.json`
- `bin/spine-doctor.mjs`
- `docs/adoption/operator-runbook.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/spine-config.json`
- `bin/spine-doctor.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-232 worker `--model` pin landed

### Step 1: Defaults and docs
> **Plan-review checkpoint**

- [ ] Update template defaults to `cursor/auto` for worker + reviewer (document inherit in runbook)
- [ ] Runbook subsection: pi model inheritance vs spine pins
- [ ] Optional doctor warning for inherit + pi-lmstudio

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% (when code changed)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Template + runbook guide operators away from accidental LM Studio inheritance
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-238): complete Step N — description`
- `fix(SP-238): description`
- `test(SP-238): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
