# Task: SP-641 — Runbook v2.6.0 consumer resume

**Created:** 2026-07-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only after code paths land.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Document operator-facing v2.6.0 paths: #197 resume eligibility (no pause dead-end), #198 post-integrate resume limbo recovery, Python `.venv` gate evidence commands (#199), scripts/ evidence wrappers (#160 Phase A), and worktree hook `.venv` ignore / no-commit (#200). Cross-link detached-first (#163/#185).

**Source:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../docs/PRD-v2.6.0-consumer-resume-handoff.md) §6 FR-REL260-07

## Dependencies

- **Task:** SP-635
- **Task:** SP-637
- **Task:** SP-638
- **Task:** SP-640

## Context to Read First

- `docs/adoption/operator-runbook.md`
- GitHub #197 #198 #199 #200 #160

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

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Add consumer resume + Python evidence section

- [ ] Document #197/#198 recovery commands
- [ ] Document `.venv/bin/python` evidence + scripts/ wrappers
- [ ] Document hook ignore / never commit `.venv`

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — v2.6.0 consumer resume + Python evidence

**Check If Affected:**
- None

## Completion Criteria

- [ ] Runbook covers #197–#200 and #160 Phase A operator paths

## Do NOT

- Change engine/CLI code
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `docs(SP-641): runbook v2.6.0 consumer resume and Python evidence`
