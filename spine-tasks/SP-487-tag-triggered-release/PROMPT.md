# Task: SP-487 — Decouple npm publish from push, use tag-triggered release workflow

**Created:** 2026-07-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Replaces a CI workflow file and adds a new one; touches publish secrets but doesn't modify them. Low blast radius (CI config only), no application code changes, easy revert.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 1, Reversibility: 0

## Canonical Task Folder

```
spine-tasks/SP-487-tag-triggered-release/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

The current `publish.yml` workflow triggers on every CI success on `main` via `workflow_run`, causing wasteful API calls, noisy workflow history (dozens of "already on npm; skipping" runs), and accidental publish risk if someone bumps `package.json` without intending to release.

Replace with a `release.yml` triggered on `v*` tag pushes: checkout at tag ref, run tests, `npm publish --access public`, create GitHub Release with auto-generated notes. Remove the old `publish.yml`.

**Closes:** [#138](https://github.com/beettlle/pi-spine/issues/138)

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `.github/workflows/publish.yml` — current publish workflow
- `.github/workflows/ci.yml` — current CI workflow (to verify it doesn't need changes)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `.github/workflows/release.yml`
- `.github/workflows/publish.yml`
- `docs/release/npm-publish.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| artifactsMustExist | `.github/workflows/release.yml` |

## Steps

### Step 0: Preflight

- [ ] `.github/workflows/publish.yml` exists
- [ ] Identify which secrets are used (`NPM_TOKEN` or `NPMSECRET`)
- [ ] Confirm CI workflow does not depend on `publish.yml`

### Step 1: Create release.yml workflow

- [ ] Create `.github/workflows/release.yml` triggered on `push: tags: ['v*']`
- [ ] Steps: checkout at tag ref, setup Node, install deps, run tests, `npm publish --access public`
- [ ] Add `gh release create` step with `--generate-notes` for auto release notes
- [ ] Use the same secret name as current `publish.yml` for `NODE_AUTH_TOKEN`
- [ ] Add `workflow_dispatch` trigger for manual re-publish if tag workflow fails
- [ ] Run targeted validation: `act -l` or manual review of YAML syntax

**Artifacts:**
- `.github/workflows/release.yml` (new)

### Step 2: Remove publish.yml

- [ ] Delete `.github/workflows/publish.yml`
- [ ] Verify no other workflows reference `publish.yml` via `workflow_run`

**Artifacts:**
- `.github/workflows/publish.yml` (deleted)

### Step 3: Update release documentation

- [ ] Update `docs/release/npm-publish.md` to reflect new tag-triggered process
- [ ] Document release process: `npm version <patch|minor|major>` then `git push --tags`
- [ ] Note that `workflow_dispatch` is available for manual re-publish

**Artifacts:**
- `docs/release/npm-publish.md` (modified)

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify release.yml YAML is valid (no syntax errors)
- [ ] Verify publish.yml is deleted
- [ ] Verify no broken workflow_run references
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Release docs updated
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/release/npm-publish.md` — new release process

**Check If Affected:**
- `README.md` — if it references the publish workflow

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `release.yml` triggers on `v*` tags only
- [ ] `publish.yml` removed
- [ ] Release documentation updated with new process
- [ ] Existing `NPM_TOKEN`/`NPMSECRET` secret reused (no new secrets needed)

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-487): complete Step N — description`
- **Bug fixes:** `fix(SP-487): description`
- **Tests:** `test(SP-487): description`
- **Hydration:** `hydrate: SP-487 expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Modify or expose secrets in source code
- Change CI workflow (ci.yml) behavior

---

## Amendments (Added During Execution)
