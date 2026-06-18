# Task: SP-296 — Engine orphan resume core

**Created:** 2026-06-18
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Allow batch resume when engine PID dead without manual pause first.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement core dead-engine resume path (parent SP-284, issue #7).

**Required behavior:**
1. When engine PID is absent/stale and diagnosis is `engine_orphaned` or recoverable `worker_orphaned`, `batch resume --attached` succeeds without prior `batch pause`.
2. `--force` bypasses `phase: running` only when engine is confirmed dead.
3. Reuse `finalizeBatchForIntegrate` when post-merge limbo conditions hold.

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

```bash
spine settings set agents.worker.model cursor/auto
spine settings set agents.reviewer.model google/gemini-3.1-pro-preview
```

## Context to Read First

- `spine-tasks/SP-284-engine-orphan-resume/PROMPT.md`
- `src/batch/resume-multi-validate.mjs`
- `src/batch/resume-multi.mjs`
- `src/batch/detached-start.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-multi-validate.mjs`
- `src/batch/resume-multi.mjs`
- `src/batch/detached-start.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/resume-multi-validate.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Trace resume rejection for phase running + dead enginePid
- [ ] Read issue #7 timeline

### Step 1: Dead-engine resume path

> **Plan-review checkpoint**

- [ ] Resume allowed when engine orphaned
- [ ] Force bypass only when PID confirmed dead
- [ ] Post-merge limbo finalize wired

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-296): complete Step N — description`
- `fix(SP-296): description`
- `test(SP-296): description`

## Do NOT

- Auto-resume while engine PID alive and batch intentionally paused
- Close issue in this slice (SP-297 delivery)
---

## Amendments (Added During Execution)
