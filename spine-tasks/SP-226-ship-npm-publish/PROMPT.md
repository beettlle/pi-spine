# Task: SP-226 — npm publish execution

**Created:** 2026-06-12
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Human-gated publish; checklist execution only with operator approval.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-226-ship-npm-publish/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-14: Execute npm publish + pi.dev listing **after** Phase 23–25 exit criteria and explicit human operator approval. Complete v1.0 checklist including dry-run `npm pack`. Document version bump decision. **Do not run `npm publish` without operator sign-off.**

## Dependencies

- **Task:** SP-225

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/release/v1.0-checklist.md`
- `docs/release/npm-publish.md`
- `docs/PRD-v2.2-ship-readiness-handoff.md` — FR-SHIP-14

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/v1.0-checklist.md`
- `docs/release/npm-publish.md`
- `package.json`
- `README.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| artifactsMustExist | `docs/release/v1.0-checklist.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-225 Done and all Phase 23–25 exit checkboxes green
- [ ] Obtain explicit human operator approval before publish

### Step 1: Pre-release checklist
> **Plan-review checkpoint**


- [ ] Complete v1.0 checklist Pre-release + Dry-run pack sections
- [ ] Document version bump decision (0.1.0 vs 1.0.0)
- [ ] Prepare pi.dev listing fields

### Step 2: Publish (human-gated)

- [ ] Run `npm publish --access public` only after operator approval recorded
- [ ] Execute post-publish smoke per checklist
- [ ] Record approval timestamp in checklist or release notes

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Checklist complete
- [ ] CONTEXT Phase 26 Done
- [ ] Create `.DONE`

## Completion Criteria

- [ ] npm publish executed with human approval
- [ ] Post-publish smoke passed
- [ ] pi.dev listing prepared
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-226): complete Step N — description`
- `fix(SP-226): description`
- `test(SP-226): description`

## Do NOT

- Run npm publish without explicit human operator approval
- Skip Phase 23–25 exit verification

---

## Amendments (Added During Execution)
