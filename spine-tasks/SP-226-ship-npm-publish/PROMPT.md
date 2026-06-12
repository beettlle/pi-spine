# Task: SP-226 — npm publish execution (human-gated)

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Human-gated publish only; pre-release checklist is SP-242.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-226-ship-npm-publish/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-14 (phase 2): Execute npm publish + pi.dev listing **after** SP-242 pre-release checklist and explicit human operator approval. **Do not run `npm publish` without operator sign-off.**

## Dependencies

- **Task:** SP-242

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
| testCommand | `true` |
| artifactsMustExist | `docs/release/v1.0-checklist.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-242 Done (pre-release + dry-run pack complete)
- [ ] Obtain explicit human operator approval before publish

### Step 1: Publish (human-gated)
> **Plan-review checkpoint**

- [ ] Run `npm publish --access public` only after operator approval recorded
- [ ] Execute post-publish smoke per checklist
- [ ] Record approval timestamp in checklist or release notes

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] CONTEXT Phase 26 Done
- [ ] Create `.DONE`

## Completion Criteria

- [ ] npm publish executed with human approval
- [ ] Post-publish smoke passed
- [ ] pi.dev listing prepared
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-226): complete Step N — description`
- `fix(SP-226): description`
- `test(SP-226): description`

## Do NOT

- Run npm publish without explicit human operator approval
- Repeat pre-release checklist work (SP-242)

---

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-12
**Issue:** Original M packet combined checklist/dry-run and publish.
**Resolution:** Pre-release checklist moved to SP-242; SP-226 is publish-only (Size S).
