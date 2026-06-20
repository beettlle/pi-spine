# Task: SP-317 — Integrate rules-manifest drift handling

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** After successful batch, `spine integrate` blocked on main-worktree `.spine/rules-manifest.json` substantive drift (worker-added rule entries), forcing manual commit before integrate (#22).
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #22**: batch `20260620T194352` — gate approved, but integrate refused:

```
.spine/rules-manifest.json has uncommitted content changes beyond generatedAt — commit or stash before integrate
```

Workers updated rules-manifest on **main** worktree (new spine-operator/worker/authoring entries). Operator workaround: manual commit (`272cb26`) then re-run integrate.

**Required behavior (pick minimal viable):**

1. **Integrate prep:** Auto-commit or auto-stash rules-manifest when drift is worker-generated (new rule entries from batch workers) and gate is approved, OR
2. **Worker isolation:** Lane workers must not mutate main-worktree rules-manifest (only lane worktrees), OR
3. **Preflight hint:** Document + doctor check when rules-manifest drift would block integrate post-batch

Prefer (2) or (1) with safe auto-commit of manifest-only changes; do not silently integrate unrelated dirty files.

**Closes:** [#22](https://github.com/beettlle/pi-spine/issues/22)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #22
- `src/batch/integrate.mjs` — rules-manifest clean check
- `src/batch/engine-lanes/merge.mjs` — generatedAt-only drift resolution
- `spine-tasks/SP-227-preflight-manifest-drift/PROMPT.md` — preflight manifest drift
- `spine-tasks/SP-081-cursor-rules-repo-commit/PROMPT.md` — rules manifest commit patterns

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/integrate.mjs`
- `src/batch/rules-manifest-drift.mjs` (new or extend existing helper)
- `src/batch/worker-host.mjs` (if worker isolation fix)
- `tests/batch/integrate-rules-manifest-drift.test.mjs` (new)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-rules-manifest-drift.test.mjs` |
| fileScopeMustChange | `src/batch/integrate.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/integrate-rules-manifest-drift.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm integrate check rejects substantive rules-manifest drift (#22 repro)
- [ ] Trace how workers write rules-manifest on main vs lane worktrees
- [ ] Review SP-227 preflight drift handling for reuse

### Step 1: Fix integrate rules-manifest drift path

- [ ] Implement chosen approach (worker isolation OR integrate auto-commit manifest-only OR doctor/preflight hint)
- [ ] Preserve fail-closed for non-manifest dirty files on main
- [ ] generatedAt-only drift still auto-resolved

### Step 2: Testing & Verification

- [ ] Test: worker-added manifest entries do not block integrate (or are isolated to lane)
- [ ] Test: unrelated main-worktree dirty still blocks integrate
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook — integrate + rules-manifest drift
- [ ] Close issue #22 (`gh issue close 22`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — rules-manifest drift before integrate

**Check If Affected:**

- `docs/adoption/bootstrap-checklist.md`

## Completion Criteria

- [ ] Integrate no longer requires manual rules-manifest commit for worker-generated entries
- [ ] Unrelated dirty files still block integrate
- [ ] Tests pass with coverage gate
- [ ] Issue #22 closed

## Git Commit Convention

- `feat(SP-317): complete Step N — description`
- `fix(SP-317): description`
- `test(SP-317): description`

## Do NOT

- Auto-commit unrelated main-worktree changes during integrate
- Delete or truncate existing rules-manifest entries
- Skip integrate gate approval

---

## Amendments (Added During Execution)
