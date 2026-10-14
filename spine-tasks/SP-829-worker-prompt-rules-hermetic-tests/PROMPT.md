# Task: SP-829 — Hermetic worker-prompt-rules tests

**Created:** 2026-10-14
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Test-only change. The risk is a test that passes for the wrong reason, for example a fixture where no rule could ever be excluded.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** `tests/batch/worker-prompt-rules.test.mjs` runs `buildWorkerTailPrompt` and `buildWorkerContextAsync` against the real repo (`PROJECT_ROOT`, line 13). Two tests assert that the repo's own rules are selected: "buildWorkerTailPrompt includes critical-rules for JS-scoped task" (~22-53) expects `.cursor/rules/javascript-3-development-standards.mdc`, and "buildWorkerContextAsync appends config.standards end-to-end" (~55-71) expects `.cursor/rules/general-llm-anti-patterns.mdc`. Commit `13ea1975` added `.spine/rules-profile.json`, whose `worker.neverInclude` lists both files. `selectRulesFromManifest` (`src/config/cursor-rules/select.mjs` ~162-168) removes `neverInclude` entries after adding `config.standards`, by design, so both tests fail (`release:check` after v2.27.1 wave 0: 2875/2877). The engine is correct; the tests depend on the repo's mutable rules profile. With no profile file, `loadRulesProfile` uses `DEFAULT_RULES_PROFILE` (`src/config/cursor-rules/profile.mjs` ~43): worker `neverInclude` is empty and `globMatch` is true. `discover.mjs` ~112-116 classifies `alwaysApply: true` as `always` and rules with `globs` as `glob`.

## Mission

`npm run release:check` is green again and the worker rules tests no longer read the repo's own `.cursor/rules/` or `.spine/rules-profile.json`.

1. **Fixture project** (in the test file): a helper that creates an `mkdtemp` root with `.cursor/rules/` containing:
   - `critical-rules-quick-reference.mdc` with `alwaysApply: true`;
   - `javascript-3-development-standards.mdc` with `globs` matching `**/*.mjs` and `alwaysApply: false`;
   - `general-llm-anti-patterns.mdc` with no globs and `alwaysApply: false`.
   No `.spine/rules-profile.json`. Follow `tests/config/worker-context.test.mjs` ~77-100 (frontmatter format, `rm` in `finally`).
2. **Rewrite the two failing tests** to use the fixture for `projectRoot`, `worktreePath`, `taskFolder`, and `donePath`. Keep their assertions: the tail contains `Project standards & reference` and `critical-rules-quick-reference.mdc`; the JS glob rule is selected for the JS file scope; `config.standards` with a duplicated path appears once in `selection.paths` and in `selection.entries`.
3. **Pin the precedence rule**: a new test whose fixture also writes `.spine/rules-profile.json` with `worker.neverInclude: ["general-llm-anti-patterns.mdc"]` and passes that rule in `config.standards`. Assert it is absent from `selection.paths`. Copy the profile shape from `.spine/rules-profile.json` (`profileVersion: 1`); if `loadRulesProfile` requires more keys, follow its validator.
4. Leave the other two tests in the file as they are.

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient`, which reviews this task's diff with stet (`.review/config.toml`: `qwen/qwen3.8-27b` on LM Studio with the OpenJev critic). When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. Record stet reviewer bugs under Discoveries in STATUS.md. Never dismiss a real defect without fixing it. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Dependencies

- **Task:** SP-828 (stet contract script and review config used by this Contract)

## Context to Read First

- `tests/batch/worker-prompt-rules.test.mjs` (whole file, 126 lines)
- `tests/config/worker-context.test.mjs` 55-107
- `src/config/cursor-rules/select.mjs` 103-190
- `src/config/cursor-rules/profile.mjs` 40-70 and the profile validator

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) and OpenJev System One at `http://127.0.0.1:8080`, for the stet step of the Contract only (unit tests need neither)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `tests/batch/worker-prompt-rules.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/worker-prompt-rules.test.mjs tests/config/worker-context.test.mjs tests/batch/worker-prompt.test.mjs && bash scripts/spine-stet-contract-run.sh lenient` |
| fileScopeMustChange | `tests/batch/worker-prompt-rules.test.mjs` |
| fileScopeMustNotChange | `.review/**`, `.spine/**`, `.cursor/**`, `src/**` |

## Steps

### Step 0: Preflight

- [ ] Reproduce the 2 failures with `node --experimental-strip-types --test tests/batch/worker-prompt-rules.test.mjs`
- [ ] Confirm the profile validator's required keys
- [ ] Dependencies satisfied

### Step 1: Fixture and rewrite

- [ ] Fixture helper
- [ ] Two failing tests use the fixture
- [ ] `neverInclude` beats `config.standards` test

**Artifacts:**
- `tests/batch/worker-prompt-rules.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] `tests/batch/worker-prompt-rules.test.mjs` passes and reads no files under the repo's `.cursor/` or `.spine/`
- [ ] A test asserts `worker.neverInclude` excludes a rule passed in `config.standards`

## Git Commit Convention

- `test(SP-829): hermetic worker-prompt-rules fixtures (release:check after 13ea1975)`

## Do NOT

- Change `src/` to make the old assertions pass
- Edit `.spine/rules-profile.json` or `.cursor/rules/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
