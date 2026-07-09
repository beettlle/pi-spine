# STATUS — SP-546 best-of-n external project-root fix

**Task:** SP-546
**Status:** In progress

## Steps

### Step 0: Preflight

- [x] Reproduce: external `--project-root` + `@file` resolves from worktree cwd; headless pi lacks `--approve`; no empty-log watchdog

### Step 1: Fix project-root spawn

- [x] Ensure pi cwd, env, and prompt delivery work for external repos
- [x] Add timeout / stderr surfacing when log stays empty beyond threshold
- [x] Preserve existing in-repo behavior

### Step 2: Regression test

- [x] Add `tests/scripts/best-of-n-external-root.test.mjs` with isolated temp git fixture
- [x] Test validates spawn args / early output without requiring live cursor/auto

### Step 3: Testing & Verification

- [ ] Pending

### Step 4: Documentation & Delivery

- [ ] Pending
