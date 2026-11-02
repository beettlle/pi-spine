# Task: SP-855 — Code and final reviewers get glob-scoped rules for the task's files

**Created:** 2026-11-01
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Reviewer prompts change for every code/final review. Too wide a scope pulls extra rule packs into the 16 KiB reviewer budget; too narrow keeps reviewers blind to language rules.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `resolveReviewScopePaths` (`src/batch/review-scope.mjs` ~113-136) returns the PROMPT File Scope for `plan`, `git diff --name-only <baseline>..HEAD` for `code` (`resolveCodeReviewScopePaths` ~75-87, which returns `[]` on error or empty diff), and always `[]` for `final`. #357 shows code reviews with 0 scope paths in 4/4 events and final reviews in 7/7 events across three stet-repo batches, so only always-apply rules reached them (no `go-1-21-development-standards.mdc` for Go diffs). Called from `buildReviewerSystemPrompt` (`src/batch/review-step.mjs` ~68) and `spine rules select --role reviewer` (`src/cli/rules.mjs` ~287).

## Mission

Closes #357 — Code and final reviews match glob rules against the files the task touches:

1. **Code** — diff paths as today; when the diff resolves to no paths (no baseline, git error, or empty), fall back to the PROMPT File Scope.
2. **Final** — the diff paths when a baseline is given and non-empty, else the PROMPT File Scope.
3. **Tests** — code with diff → diff paths; code with empty diff or git error → File Scope; final with baseline → diff paths; final without baseline → File Scope. Update the existing "final returns empty scope" test.
4. **Docs** — `docs/design/cursor-rules-discovery.md` (~153 table row) and `skills/create-spine-tasks/SKILL.md` (~416 Tier 4 row, ~489 Reviewer rules paragraph) describe the new code/final scope.

## Dependencies

- **None**

## Context to Read First

- GitHub #357
- `src/batch/review-scope.mjs` (whole file, 136 lines)
- `tests/batch/review-scope.test.mjs`
- `docs/design/cursor-rules-discovery.md` 140-160
- `skills/create-spine-tasks/SKILL.md` 410-420, 485-492

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio + OpenJev for the stet `reviewCommand` only
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/review-scope.mjs`
- `tests/batch/review-scope.test.mjs`
- `docs/design/cursor-rules-discovery.md`
- `skills/create-spine-tasks/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/review-scope.test.mjs tests/config/reviewer-context.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh lenient SP-855` |
| fileScopeMustChange | `src/batch/review-scope.mjs`, `tests/batch/review-scope.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `resolveReviewScopePaths` and `resolveCodeReviewScopePaths`; report the blast radius in STATUS
- [ ] `rg -n "final returns empty|scopePaths" tests/` — list assertions that change

### Step 1: Scope resolution

- [ ] Code: File Scope fallback on empty diff / error
- [ ] Final: diff with baseline, else File Scope

**Artifacts:**
- `src/batch/review-scope.mjs` (modified)

### Step 2: Tests

- [ ] Four cases above; existing plan test unchanged

**Artifacts:**
- `tests/batch/review-scope.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discovery doc table row and skill Tier 4 / Reviewer rules text updated
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-855-reviewer-rules-scope-final/.DONE`

**Stet review (Contract `reviewCommand`, blocking):** fix real defects in this task's diff. For a stet false positive, `stet dismiss <id> <reason>` citing lint/typecheck/test evidence, record it under Discoveries, and file it at https://github.com/beettlle/stet/issues. Never edit `.review/` or remove the `reviewCommand`.

## Documentation Requirements

**Must Update:**
- `docs/design/cursor-rules-discovery.md` — reviewer scope table
- `skills/create-spine-tasks/SKILL.md` — Tier 4 and Reviewer rules text

**Check If Affected:**
- `docs/adoption/operator-runbook.md` FR-REV-08 mentions (note in Discoveries; do not edit)

## Completion Criteria

- [ ] Code and final reviews never resolve to an empty scope when the task has a File Scope

## Git Commit Convention

- `fix(SP-855): code/final reviewer rules scoped to task files`

## Do NOT

- Change the reviewer byte cap or rule ordering
- Edit `src/config/reviewer-context.mjs` (SP-852 tests it this batch)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
