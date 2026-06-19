# Task: SP-304 — README doc index sync

**Created:** 2026-06-18
**Size:** S

## Review Level: 0 (None)

**Assessment:** Doc navigation sync; disjoint scope from SP-303.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Canonical Task Folder

```
spine-tasks/SP-304-readme-doc-index-sync/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Update doc navigation and adoption flow so README's reduced role ("overview only") is reflected in indexes and bootstrap checklist. Sync `package.json` description if it mirrors verbose README copy.

## Dependencies

- **Task:** SP-302 (slim README is canonical overview)

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `README.md` — post-SP-302
- `docs/README.md`
- `docs/INDEX.md`
- `docs/adoption/bootstrap-checklist.md`
- `package.json`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/README.md`
- `docs/INDEX.md`
- `docs/adoption/bootstrap-checklist.md`
- `docs/adoption/real-project-readiness.md`
- `package.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read slim README and confirm quickstart path
- [ ] Read current docs/README.md "For New Users" section

### Step 1: Sync indexes and adoption

- [ ] `docs/README.md`: change "Project overview and quick start" → "Project overview"; add `why-pi-spine.md` link; point operators to QUICK-REFERENCE + runbook
- [ ] `docs/INDEX.md`: same navigation updates if adoption section exists
- [ ] `bootstrap-checklist.md`: step 1 = README quickstart; deep steps link to QUICK-REFERENCE, EXECUTION-FLOW, runbook
- [ ] `real-project-readiness.md`: update only if it calls README an operator manual
- [ ] `package.json`: update `description` if stale vs slim README one-liner

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- Files in File Scope as needed

**Check If Affected:**
- `docs/adoption/real-project-readiness.md` — only if references stale README role

## Completion Criteria

- [ ] Doc indexes reflect README-as-overview model
- [ ] Bootstrap checklist aligned with slim quickstart
- [ ] Tests passing
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-304): complete Step N — description`
- `fix(SP-304): description`

## Do NOT

- Edit `README.md` (SP-302)
- Edit QUICK-REFERENCE / runbook content (SP-303)
- Skip tests

---

## Amendments (Added During Execution)
