# Task: SP-418 — Agent outer loop how-to doc

**Created:** 2026-07-02
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only how-to; no code paths.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Add canonical how-to **`docs/adoption/agent-orchestrated-waves.md`** for the external-agent multi-wave outer loop (responsibility split, per-wave land loop, diagnosis→action table, anti-patterns). Cross-link from operator-runbook and bootstrap-checklist. Partial delivery for GitHub #90 (docs surface; skill/slash in SP-419).
**GitHub:** [#90](https://github.com/beettlle/pi-spine/issues/90) (partial)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #90
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/agent-orchestrated-waves.md`
- `docs/adoption/operator-runbook.md`
- `docs/adoption/bootstrap-checklist.md`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #90 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Preflight

- [ ] Read GitHub issue #90 acceptance criteria
- [ ] Read operator-runbook §4 land loop

### Step 1: Author how-to doc

- [ ] Create `docs/adoption/agent-orchestrated-waves.md` (Diátaxis how-to)
- [ ] Add responsibility split + recommended outer loop bash blocks
- [ ] Add diagnosis→agent action table and anti-patterns

### Step 2: Cross-links

- [ ] Link from operator-runbook (§4.2 or pointer)
- [ ] Link from bootstrap-checklist after-first-batch step
- [ ] Add one-line pointer in QUICK-REFERENCE.md

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/agent-orchestrated-waves.md` — new canonical how-to
- `docs/adoption/operator-runbook.md` — cross-link
- `docs/adoption/bootstrap-checklist.md` — cross-link

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-418): complete Step N — description`
- `fix(SP-418): description`
- `hydrate: SP-418 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
