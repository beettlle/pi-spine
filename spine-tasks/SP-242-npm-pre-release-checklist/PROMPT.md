# Task: SP-242 — npm pre-release checklist and dry-run

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** v1.0 checklist pre-release sections and npm pack dry-run before publish.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-242-npm-pre-release-checklist/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-14 (phase 1): Complete v1.0 checklist Pre-release + Dry-run pack sections after SP-225. Document version bump decision (0.1.0 vs 1.0.0) and prepare pi.dev listing fields. **Do not run npm publish** (SP-226).

## Dependencies

- **Task:** SP-225

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/release/v1.0-checklist.md`
- `docs/release/npm-publish.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/v1.0-checklist.md`
- `docs/release/npm-publish.md`
- `package.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| artifactsMustExist | docs/release/v1.0-checklist.md |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-225 Done
- [ ] Read v1.0 checklist Pre-release section

### Step 1: Pre-release checklist
> **Plan-review checkpoint**

- [ ] Complete Pre-release + Dry-run pack sections
- [ ] Run `npm pack` dry-run and record output
- [ ] Document version bump decision and pi.dev listing fields

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Checklist pre-release sections complete
- [ ] Dry-run pack recorded
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-242): complete Step N — description`
- `fix(SP-242): description`
- `test(SP-242): description`

## Do NOT

- Expand scope beyond File Scope without replan
- Skip tests

---

## Amendments (Added During Execution)
