# Task: SP-305 — README release verify

**Created:** 2026-06-18
**Size:** S

## Review Level: 0 (None)

**Assessment:** Exit verification gate before next release; fix broken anchors only.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Canonical Task Folder

```
spine-tasks/SP-305-readme-release-verify/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Release gate for README trim epic: verify line budget, zero PRD IDs in README, link integrity, new-user read-through criteria, and test suite green. Mark Phase 33 complete in CONTEXT.md.

## Dependencies

- **Task:** SP-303 (doc absorption)
- **Task:** SP-304 (index sync)

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `README.md`
- `docs/adoption/why-pi-spine.md`
- `package.json`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `README.md` (broken anchor fixes only)
- `spine-tasks/CONTEXT.md` (Phase 33 completion only)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-303 and SP-304 `.DONE` exist

### Step 1: Release verification

- [ ] `wc -l README.md` ≤ 180
- [ ] `rg 'FR-|GAP-|NFR-|§' README.md` — no matches
- [ ] Manual read-through: new user can install + start batch from README without scrolling past ~line 120 for quickstart
- [ ] Recovery paths reachable in ≤2 clicks to operator runbook
- [ ] All README `docs/` relative links resolve
- [ ] Version line in README matches `package.json`
- [ ] Note in STATUS if pi.dev listing copy needs manual sync outside repo

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Mark Phase 33 tasks Done in `spine-tasks/CONTEXT.md`
- [ ] Fix any broken README anchors found in Step 1
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `spine-tasks/CONTEXT.md` — Phase 33 exit

**Check If Affected:**
- `README.md` — anchor fixes only

## Completion Criteria

- [ ] All release verification checks pass
- [ ] Phase 33 marked complete in CONTEXT
- [ ] Tests passing
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-305): complete Step N — description`
- `fix(SP-305): description`

## Do NOT

- Re-expand README content
- Change application code
- Skip verification grep/line-count checks

---

## Amendments (Added During Execution)
