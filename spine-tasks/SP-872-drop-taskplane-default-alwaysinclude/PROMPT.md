# Task: SP-872 — Drop Taskplane rules from default worker alwaysInclude / init profile

**Created:** 2026-11-18
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Every worker prompt pays Taskplane rule tokens by default even on spine-native projects; opt-out requires neverInclude.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** `DEFAULT_RULES_PROFILE.worker.alwaysInclude` is still `["taskplane-worker-cursor.mdc"]`, and `templates/rules-profile.json` / init standards still assume Taskplane. Spine-native workers already have `.spine/agents/worker.md`.

## Mission

Closes #344 — Spine defaults no longer force Taskplane worker rules:

1. **Default profile** — `DEFAULT_RULES_PROFILE.worker.alwaysInclude` becomes `[]` (empty). Keep reviewer `neverInclude` entries that exclude Taskplane authoring/worker rules (harmless; documents intent).
2. **Init template** — `templates/rules-profile.json` worker `alwaysInclude` matches (empty). Projects that need Taskplane can set `alwaysInclude` explicitly.
3. **Init standards (if in scope)** — Stop listing `taskplane-worker-cursor.mdc` / `taskplane-task-authoring.mdc` in `DEFAULT_SPINE_INIT_STANDARDS` unless a Taskplane-compat preset still needs them — prefer spine-native defaults; record any preset carve-out in Discoveries.
4. **Tests** — Update profile/init/worker-prompt tests that assert Taskplane alwaysInclude; add assertion that default alwaysInclude is empty.

## Dependencies

- **None**

## Context to Read First

- GitHub #344
- `src/config/cursor-rules/profile.mjs` (`DEFAULT_RULES_PROFILE`)
- `templates/rules-profile.json`
- `src/config/worker-context.mjs` (`DEFAULT_SPINE_INIT_STANDARDS`)
- `tests/config/cursor-rules/profile.test.mjs`, `tests/cli/spine-init-rules.test.mjs`, `tests/batch/worker-prompt-rules.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/config/cursor-rules/profile.mjs`
- `templates/rules-profile.json`
- `src/config/worker-context.mjs`
- `tests/config/cursor-rules/profile.test.mjs`
- `tests/config/cursor-rules/select.test.mjs`
- `tests/cli/spine-init-rules.test.mjs`
- `tests/batch/worker-prompt-rules.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/config/cursor-rules/profile.test.mjs tests/config/cursor-rules/select.test.mjs tests/cli/spine-init-rules.test.mjs tests/batch/worker-prompt-rules.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh lenient SP-872` |
| fileScopeMustChange | `src/config/cursor-rules/profile.mjs`, `templates/rules-profile.json`, `tests/config/cursor-rules/select.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm current alwaysInclude defaults and which tests pin Taskplane
- [ ] GitNexus impact on `DEFAULT_RULES_PROFILE`; report in STATUS

### Step 1: Drop Taskplane from defaults

- [ ] Empty worker alwaysInclude in DEFAULT_RULES_PROFILE + templates/rules-profile.json
- [ ] Adjust DEFAULT_SPINE_INIT_STANDARDS per Mission item 3

### Step 2: Tests

- [ ] Update assertions; prove default alwaysInclude is empty
- [ ] Update `tests/config/cursor-rules/select.test.mjs` assertions that pin Taskplane in `DEFAULT_RULES_PROFILE.alwaysInclude`

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-872-drop-taskplane-default-alwaysinclude/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` / init docs — note if alwaysInclude opt-in for Taskplane needs a sentence

## Completion Criteria

- [ ] Default worker alwaysInclude is empty
- [ ] Init template matches
- [ ] Tests updated and green
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-872): drop Taskplane from default worker alwaysInclude (#344)`

## Do NOT

- Delete Taskplane rule files from the repo
- Break Taskplane-compat presets that explicitly opt in
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- 2026-11-18 — Final REPLAN: add `tests/config/cursor-rules/select.test.mjs` to File Scope, Contract `testCommand`, and `fileScopeMustChange` so the worker can fix the out-of-scope alwaysInclude assertion.
