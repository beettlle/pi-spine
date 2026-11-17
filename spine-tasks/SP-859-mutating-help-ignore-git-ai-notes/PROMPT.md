# Task: SP-859 — mutating-help snapshot ignores git-ai refs/notes and .git/ai

**Created:** 2026-11-16
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Local `release:check` fails on git-ai hosts while CI stays green — blocks release trains on maintainer machines.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `tests/cli/mutating-help.test.mjs` `snapshotProject` hashes every git ref via `git for-each-ref`. The git-ai daemon adds `refs/notes/ai` (and may touch `.git/ai/**`) seconds after a commit in the temp fixture. Spine mutating `--help` paths never write those refs, so the before/after snapshot falsely fails.

## Mission

Closes #372 — `--help` side-effect snapshots ignore git-ai annotations:

1. **Snapshot filter** — When collecting refs (and any `.git` paths included in the snapshot), ignore `refs/notes/*` and `.git/ai/**` (or equivalent: strip those lines from the ref listing / skip those paths). Spine commands must still be treated as side-effecting if they change any other ref or tracked file.
2. **Regression test** — Add a focused assertion that a synthetic `refs/notes/ai` (and optionally a `.git/ai` path) present only in the "after" snapshot does **not** fail the equality check used by the mutating-help test. Prefer extending the existing helper rather than spawning a real git-ai daemon.
3. **No broad silence** — Do not ignore all refs; only notes/ai annotations that no spine command writes.

## Dependencies

- **None**

## Context to Read First

- GitHub #372
- `tests/cli/mutating-help.test.mjs` (`snapshotProject`, mutating `--help` test)
- `docs/release/npm-publish.md` (workaround note — do not edit; SP-858 owns docs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `tests/cli/mutating-help.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/cli/mutating-help.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-859` |
| fileScopeMustChange | `tests/cli/mutating-help.test.mjs` |
| fileScopeMustNotChange | `.review/**`, `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact / callers of `snapshotProject` if exported; otherwise document it is test-local
- [ ] `rg -n "for-each-ref|snapshotProject|refs/notes" tests/cli/mutating-help.test.mjs`

### Step 1: Filter + test

- [ ] Ignore `refs/notes/*` and `.git/ai/**` in the side-effect snapshot
- [ ] Synthetic notes-ref regression assertion

**Artifacts:**
- `tests/cli/mutating-help.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-859-mutating-help-ignore-git-ai-notes/.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-858 owns release-gate docs)

**Check If Affected:**
- `docs/release/npm-publish.md` — leave to SP-858

## Completion Criteria

- [ ] Snapshot ignores `refs/notes/*` and `.git/ai/**`
- [ ] Synthetic notes-ref case does not fail the equality helper
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-859): ignore git-ai refs/notes in mutating-help snapshot`

## Do NOT

- Disable or document-only without code filter
- Ignore unrelated refs (`refs/heads/*`, tags, etc.)
- Edit `src/` or `bin/`
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
