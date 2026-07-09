# Task: SP-546 — best-of-n external project-root fix

**Created:** 2026-07-08
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Script fix for pi spawn with external `--project-root`; test with stub.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Fix `scripts/best-of-n.mjs` so `cursor/auto` (and other models) produce output when `--project-root` points at an external git repo. Pi process must not hang silently with empty `bon-run.log`.

**Closes:** [#119](https://github.com/beettlle/pi-spine/issues/119)

## Dependencies

- SP-543

## Context to Read First

- `scripts/best-of-n.mjs`
- `spine-tasks/CONTEXT.md`

## File Scope

- `scripts/best-of-n.mjs`
- `tests/scripts/best-of-n-external-root.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/scripts/best-of-n-external-root.test.mjs` |
| fileScopeMustChange | `scripts/best-of-n.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce with issue repro steps (dry-run or stub pi acceptable)

### Step 1: Fix project-root spawn

- [ ] Ensure pi cwd, env, and prompt delivery work for external repos
- [ ] Add timeout / stderr surfacing when log stays empty beyond threshold
- [ ] Preserve existing in-repo behavior

**Artifacts:**
- `scripts/best-of-n.mjs` (modified)

### Step 2: Regression test

- [ ] Add `tests/scripts/best-of-n-external-root.test.mjs` with isolated temp git fixture
- [ ] Test validates spawn args / early output without requiring live cursor/auto

**Artifacts:**
- `tests/scripts/best-of-n-external-root.test.mjs`

### Step 3: Testing & Verification

- [ ] `node --test tests/scripts/best-of-n-external-root.test.mjs`
- [ ] `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Close #119: `gh issue close 119 --comment "Fixed best-of-n external project-root — SP-546"`
- [ ] Create `.DONE`

## Completion Criteria

- [ ] External `--project-root` no longer hangs with zero log output
- [ ] Tests pass

## Git Commit Convention

- `fix(SP-546): best-of-n external project-root output`

## Do NOT

- Change spine batch engine
