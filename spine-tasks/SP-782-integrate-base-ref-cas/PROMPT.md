# Task: SP-782 — Integrate base-ref compare-and-swap

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Integrate moves the operator's base branch; a mistake orphans commits or blocks every land loop.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** Every integrate `update-ref` on `refs/heads/<base>` omits the expected old value, so a commit that lands on base mid-integrate is silently orphaned. The ref-merge paths also run `merge-tree` on branch *names* after capturing SHAs, so a base move in between mixes trees. `mergeOrchIntoBaseViaRefs` (`integrate.mjs`) duplicates `plumbingMergeOrchIntoBase` (`integrate-worktree.mjs`) line for line.

## Mission

Partial #298 — Base-ref updates in integrate are compare-and-swap, merges use captured SHAs, and the duplicated plumbing merge is removed.

1. **CAS at every base update-ref** — pass the expected old SHA: `git update-ref refs/heads/<base> <newSha> <expectedOldSha>`.
   - `fastForwardOrchIntoBase` (`integrate.mjs` ~line 112): expected old = `baseShaBefore`.
   - Plumbing merge (`integrate-worktree.mjs` `plumbingMergeOrchIntoBase` ~line 173): expected old = captured `baseSha`.
   - `mergeInIntegrateWorktree` (`integrate-worktree.mjs` ~lines 367–371): the worktree merge already advanced base, so drop the redundant `update-ref`. Instead capture base SHA **before** the merge and verify the merge commit's first parent equals it; fail on mismatch.
2. **CAS failure is loud** — on mismatch return `{ ok: false, failureClass: "BaseMoved", error: "<base> moved during integrate (expected <old>, found <current>) — re-run spine integrate" }`. Nothing is orphaned; the caller's existing `integrate.failed` journaling and headline path handle it.
3. **SHAs, not names, in `merge-tree`** — `git merge-tree --write-tree <baseSha> <orchSha>`.
4. **Dedupe** — delete `mergeOrchIntoBaseViaRefs` from `integrate.mjs` and call the (exported) `plumbingMergeOrchIntoBase` from `integrate-worktree.mjs`. This also frees headroom under the 500-line batch module cap (`integrate.mjs` is at 497).
5. **Race test** — move base between SHA capture and `update-ref` (inject a git hook, or commit from a second process / test seam) and assert integrate fails with `BaseMoved` and the concurrent commit is still reachable from base.

SP-784 (next wave) makes the post-merge checkout sync safe; do not touch `syncPlumbingMergePathsToWorktree` here.

## Dependencies

- **None**

## Context to Read First

- `src/batch/integrate.mjs` — `mergeOrchIntoBaseViaRefs` (~lines 47–99), `fastForwardOrchIntoBase` (~lines 109–119), `runIntegrateMerge` (~lines 128–137)
- `src/batch/integrate-worktree.mjs` — `plumbingMergeOrchIntoBase` (~lines 124–176), `mergeInIntegrateWorktree` (~lines 343–374)
- `tests/batch/integrate-isolated.test.mjs` — scratch-repo fixtures to reuse
- GitHub #298 ("Base ref moved without compare-and-swap" section)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/batch/integrate.mjs`
- `src/batch/integrate-worktree.mjs`
- `tests/batch/integrate-base-cas.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/integrate-base-cas.test.mjs tests/batch/integrate-isolated.test.mjs tests/batch/integrate-worktree-sync.test.mjs` |
| fileScopeMustChange | `src/batch/integrate.mjs`, `src/batch/integrate-worktree.mjs`, `tests/batch/integrate-base-cas.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] `rg -n "update-ref" src bin` — confirm the four sites
- [ ] `rg -ln "integrate" tests/batch` — list integrate tests to keep green
- [ ] Dependencies satisfied

### Step 1: CAS + SHA merge-tree + dedupe

- [ ] Expected-old SHA at fast-forward and plumbing `update-ref`
- [ ] Worktree-merge path: redundant `update-ref` removed; first-parent check against pre-merge SHA
- [ ] `merge-tree` uses SHAs
- [ ] `mergeOrchIntoBaseViaRefs` removed; `plumbingMergeOrchIntoBase` exported and reused
- [ ] Mismatch returns `failureClass: "BaseMoved"` with an actionable message
- [ ] `integrate.mjs` and `integrate-worktree.mjs` each ≤ 500 lines

**Artifacts:**
- `src/batch/integrate.mjs`, `src/batch/integrate-worktree.mjs` (modified)

### Step 2: Race test

- [ ] Base moved mid-integrate → `BaseMoved`, concurrent commit still on base
- [ ] Happy-path fast-forward and plumbing merges still land (existing tests green)

**Artifacts:**
- `tests/batch/integrate-base-cas.test.mjs` (new)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run all integrate tests: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/integrate*.test.mjs tests/batch/salvage*.test.mjs`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-789 owns runbook edits for `BaseMoved`)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §4 Land loop

## Completion Criteria

- [ ] A base commit landing mid-integrate fails integrate with a clear message; nothing is orphaned
- [ ] No duplicated plumbing merge implementation
- [ ] Contract green
- [ ] Partial #298 (SP-784 closes)

## Git Commit Convention

- `fix(SP-782): compare-and-swap base ref updates in integrate (#298)`

## Do NOT

- Change `syncPlumbingMergePathsToWorktree` or the post-merge sync block (SP-784)
- Edit `src/batch/salvage-batch-integrate.mjs` (SP-784)
- Redesign integrate modes
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
