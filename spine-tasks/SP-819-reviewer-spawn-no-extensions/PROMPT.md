# Task: SP-819 — Reviewer spawns skip user pi extensions by default

**Created:** 2026-10-10
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Every engine and CLI review passes through `buildReviewerPiArgs`. A wrong flag or a missing opt-out breaks all reviews.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0
**Problem theory:** `buildReviewerPiArgs` (`src/batch/review-spawn.mjs` 113-141) builds `pi -p --no-session --append-system-prompt … --model … --thinking … <prompt>` with no `-ne`. The reviewer therefore loads every extension the operator installed. In v2.27.0 the third-party `pi-headroom` extension rewrote context through a `context` hook, dropped `toolCall.thoughtSignature`, and made every Gemini review fail with HTTP 400. Pi's CLI documents `-ne` / `--no-extensions` as "Disables discovered, configured, and built-in extensions. Explicit `-e` paths still load" (`node_modules/@earendil-works/pi-coding-agent/docs/cli.md` ~196). Reviewers only need pi's core tools (`read`, `bash`, `write`, and so on), which are not extensions. Workers already pass `-ne` conditionally (`bin/spine-worker-runner.mjs` ~110, via `shouldWorkerUsePiNoExtensions`). Profiles are deep-merged into `config.agents.reviewer` by `applyActiveAgentProfile` (`src/config/spine-config-load.mjs` ~101), so reading `config.agents.reviewer.loadUserExtensions` honors the active profile.

## Mission

Partial #334 — Reviewer `pi` spawns pass `-ne` by default. A new opt-out key `agents.reviewer.loadUserExtensions` (boolean, default `false`) restores the old behavior for operators who rely on an extension inside reviews.

1. **Args** (`src/batch/review-spawn.mjs`): `buildReviewerPiArgs` puts `-ne` first (before `-p`, matching the worker runner order) unless `config.agents.reviewer.loadUserExtensions === true`. Everything else is unchanged: `-p`, `--no-session`, both `--append-system-prompt` entries, model and thinking pins, prompt last.
2. **Config** — `agents.reviewer.loadUserExtensions`:
   - `src/config/settings-fields.mjs`: new `type: "boolean"` field (label "Reviewer loads user pi extensions") so `spine settings set agents.reviewer.loadUserExtensions true` works.
   - `src/config/spine-config-schema.mjs`: when the key is present on `agents.reviewer` or on any `agents.profiles.<name>.reviewer`, a non-boolean value fails validation with a clear message. Use the existing `CONFIG_*` error shape in this file.
3. **Tests**:
   - `tests/batch/review-spawn.test.mjs`: default config → args start with `-ne`; `loadUserExtensions: true` → no `-ne`; `loadUserExtensions: false` → `-ne`; model/thinking/system-prompt/prompt positions unchanged in all cases; profile-resolved config (via `applyActiveAgentProfile`) with `profiles.<p>.reviewer.loadUserExtensions: true` → no `-ne`.
   - `tests/config/settings-fields.test.mjs`: the new field is listed and typed boolean.
   - Schema: a string value (`"yes"`) is rejected; `true`/`false` accepted. Put these in `tests/config/load.test.mjs` next to the existing agent-profile validation tests.

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh default`, which reviews this task's diff with stet (`.review/config.toml`: `qwen/qwen3.8-27b` on LM Studio with the OpenJev critic). When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. Record stet reviewer bugs (invented syntax errors, stale hunks, parse failures) under Discoveries in STATUS.md. Never dismiss a real defect without fixing it. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Dependencies

- **Task:** SP-828 (stet contract script and review config used by this Contract)

## Context to Read First

- GitHub #334 (sections "Where spine is fragile" item 1 and "Proposed solution" item 1)
- `src/batch/review-spawn.mjs` 105-141; `bin/spine-worker-runner.mjs` 100-116
- `src/config/settings-fields.mjs` 70-160; `src/config/spine-config-schema.mjs` 235-330
- `src/config/spine-config-load.mjs` 85-122
- `node_modules/@earendil-works/pi-coding-agent/docs/cli.md` (`-ne` flag)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) and OpenJev System One at `http://127.0.0.1:8080`, for the stet step of the Contract only (unit tests need neither)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/review-spawn.mjs`
- `src/config/settings-fields.mjs`
- `src/config/spine-config-schema.mjs`
- `tests/batch/review-spawn.test.mjs`
- `tests/config/settings-fields.test.mjs`
- `tests/config/load.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/review-spawn.test.mjs tests/batch/reviewer-model-resolve.test.mjs tests/batch/review-no-artifact-respawn.test.mjs tests/config/settings-fields.test.mjs tests/config/load.test.mjs tests/spine-settings-set.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh default` |
| fileScopeMustChange | `src/batch/review-spawn.mjs`, `src/config/settings-fields.mjs`, `tests/batch/review-spawn.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `buildReviewerPiArgs` — record callers in Discoveries
- [ ] `rg -n '"-p", "--no-session"|piArgs\[0\]|buildReviewerPiArgs' tests` — list every test that asserts exact reviewer args; add each to the Contract run (record in Amendments if a file outside File Scope must change)
- [ ] Confirm whether the schema already rejects unknown `agents.reviewer` keys; record in Discoveries
- [ ] Dependencies satisfied

### Step 1: Reviewer args

- [ ] `-ne` by default; opt-out via `loadUserExtensions === true`

**Artifacts:**
- `src/batch/review-spawn.mjs` (modified)

### Step 2: Config key

- [ ] Settings field (boolean)
- [ ] Schema validation for base and profile reviewer sections

**Artifacts:**
- `src/config/settings-fields.mjs` (modified)
- `src/config/spine-config-schema.mjs` (modified)

### Step 3: Tests

- [ ] Arg cases above, including the profile-resolved case
- [ ] Settings field and schema cases

**Artifacts:**
- `tests/batch/review-spawn.test.mjs` (modified)
- `tests/config/settings-fields.test.mjs` (modified)
- `tests/config/load.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission)
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-825 documents the key)

**Check If Affected:**
- None

## Completion Criteria

- [ ] `buildReviewerPiArgs` includes `-ne` by default; a unit test asserts it
- [ ] With `agents.reviewer.loadUserExtensions: true`, reviewer args omit `-ne`; schema and `spine settings set` accept the key
- [ ] Reviewer model, thinking, system prompt, and prompt arguments otherwise unchanged

## Git Commit Convention

- `fix(SP-819): reviewer spawns pass pi -ne by default (#334)`

## Do NOT

- Change worker spawn args or `shouldWorkerUsePiNoExtensions` (worker isolation is deferred; #334 item 2 needs investigation first)
- Change `buildReviewerChildEnv`, spawn timeouts, or artifact polling
- Edit `.spine/spine-config.json` or add the key to it
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-10-11 (operator, SP-828 stet adoption):** Contract `testCommand` ends with `bash scripts/spine-stet-contract-run.sh default`; added `fileScopeMustNotChange` `.review/**`, the LM Studio and OpenJev services, the stet triage paragraph in Mission, and the dependency on SP-828.
