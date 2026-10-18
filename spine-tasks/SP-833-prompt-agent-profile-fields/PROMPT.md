# Task: SP-833 — PROMPT `**Profile:**`, `**Thinking:**`, `**Reviewer Profile:**` fields

**Created:** 2026-10-17
**Size:** M

## Review Level: 1 (Plan Only)

**Risk:** `parse-prompt.mjs` is a hot shared module (planner, engine queue, preflight, validate all call it). A parse regression breaks every batch launch. Review Level stays 1 because engine code review is broken until #343 lands (SP-840).
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `parsePrompt` (`src/tasks/packet/parse-prompt.mjs` 162-207) parses `**Type:**` at 178 with `/^\*\*Type:\*\*\s*(llm|execute)\s*$/im` and `**Size:**` via `size-line.mjs`. There are no per-task agent fields. `validatePrompt` / `validate-prompt.mjs` (29-66) receive only `{ mode, legacyTaskIdPrefixes, contract }`, so they cannot check profile names. `spine tasks validate` (`bin/spine-tasks.mjs` ~218) passes only `{ contract: config.contract }`; preflight (`src/config/preflight/discovery.mjs` ~311) passes `{ taskId, contract }`. The planner (`src/planner/index.mjs:46`) and engine queue (`src/batch/engine-lanes/queue.mjs:47`) call `loadTaskPacket(folder)` with no options and must keep working.

## Mission

Partial #340, Partial #355 — Parse three optional header fields and validate them against the spine config.

1. **Parse** in `parsePrompt`, next to `**Type:**`, each optional and case-insensitive on the label, one line, value trimmed:
   - `**Profile:** <name>` → `profile` (string or `null`)
   - `**Thinking:** <level>` → `thinking`, one of `off`, `minimal`, `low`, `medium`, `high`, `xhigh` (string or `null`)
   - `**Reviewer Profile:** <name>` → `reviewerProfile` (string or `null`)
   Profile names match `^[A-Za-z0-9._-]+$`. Add the three keys to the returned object always (value `null` when absent) so callers can rely on the shape.
2. **Structural validation** in `validatePrompt` (no config needed): an unrecognised `**Thinking:**` value or a malformed profile name is an error (`**Thinking:** must be one of off|minimal|low|medium|high|xhigh`). `**Profile:**` / `**Thinking:**` / `**Reviewer Profile:**` on a `**Type:** execute` task is a warning (no LLM worker / reviewer to configure) via the existing warnings path in `validate-prompt.mjs`.
3. **Config-aware validation** — accept an optional `agents` object in the options of `validate-prompt.mjs` (and pass it through `validatePrompt` / `loadTaskPacket` where needed). When `agents` is provided:
   - unknown `profile` or `reviewerProfile` (not in `agents.profiles`) → error;
   - `reviewerProfile` naming a profile with no `reviewer` block → warning (`falls back to the next reviewer precedence level`);
   - `reviewerProfile` whose per-type reviewer model is the same model family as the effective worker model (task `profile`'s worker model, else the active profile's / base worker model) → error. Use `resolveEffectiveReviewer` and `isSameModelFamily` from SP-832 (`src/config/agent-model-resolve.mjs`, `src/config/model-family.mjs`); a `blocked` entry with reason `same_model_family` or `unknown_reviewer_profile` maps to an error.
   When `agents` is not provided (planner, queue), skip these checks.
4. **Callers:** `bin/spine-tasks.mjs` (`spine tasks validate`) passes `agents: config.agents`; preflight `tasks-validate` in `src/config/preflight/discovery.mjs` passes `agents: config.agents`.

## Dependencies

- **Requires:** SP-832 (uses `resolveEffectiveReviewer` and `isSameModelFamily`)

## Context to Read First

- GitHub #340 (item 1) and #355 (Proposal)
- `src/tasks/packet/parse-prompt.mjs` 150-250
- `src/tasks/packet/validate-prompt.mjs` (whole file)
- `src/tasks/packet/index.mjs` 50-90 (`loadTaskPacket`)
- `bin/spine-tasks.mjs` 175-280
- `src/config/preflight/discovery.mjs` 280-335
- `src/config/agent-model-resolve.mjs`, `src/config/model-family.mjs` (from SP-832)
- `tests/tasks/packet-prompt.test.mjs`, `tests/tasks/validate-cli.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/tasks/packet/parse-prompt.mjs`
- `src/tasks/packet/validate-prompt.mjs`
- `src/tasks/packet/index.mjs`
- `bin/spine-tasks.mjs`
- `src/config/preflight/discovery.mjs`
- `tests/tasks/packet-prompt.test.mjs`
- `tests/tasks/prompt-agent-fields.test.mjs`
- `tests/tasks/validate-cli.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/tasks/packet-prompt.test.mjs tests/tasks/prompt-agent-fields.test.mjs tests/tasks/validate-cli.test.mjs tests/tasks/parse-prompt-duplicate-step.test.mjs tests/tasks/phase20-fixtures.test.mjs tests/batch/review-level-execute.test.mjs tests/spine-preflight.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-833` |
| fileScopeMustChange | `src/tasks/packet/parse-prompt.mjs`, `src/tasks/packet/validate-prompt.mjs`, `tests/tasks/prompt-agent-fields.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `parsePrompt`, `validatePrompt`, `loadTaskPacket` — record callers in Discoveries
- [ ] Dependencies satisfied (SP-832 exports present)

### Step 1: Parse fields

- [ ] `profile`, `thinking`, `reviewerProfile` parsed and always present on the result
- [ ] Structural errors and execute-task warnings

**Artifacts:**
- `src/tasks/packet/parse-prompt.mjs` (modified)
- `src/tasks/packet/validate-prompt.mjs` (modified)

### Step 2: Config-aware validation + callers

- [ ] Optional `agents` option threaded through validation
- [ ] Unknown profile / reviewer profile errors; missing reviewer block warning; same-family error
- [ ] `spine tasks validate` and preflight pass `agents`

**Artifacts:**
- `src/tasks/packet/index.mjs` (modified, if `loadTaskPacket` forwards options)
- `bin/spine-tasks.mjs` (modified)
- `src/config/preflight/discovery.mjs` (modified)

### Step 3: Tests

- [ ] Parse: each field present / absent / mixed case label / invalid thinking / malformed name
- [ ] Validate with `agents`: unknown profile, unknown reviewer profile, missing reviewer block warning, same-family error (gemini worker profile + gemini reviewer profile), cross-family OK
- [ ] Validate without `agents`: no profile errors (planner path)
- [ ] `spine tasks validate` CLI reports the unknown-profile error

**Artifacts:**
- `tests/tasks/prompt-agent-fields.test.mjs` (new)
- `tests/tasks/packet-prompt.test.mjs` (modified, shape assertions if needed)
- `tests/tasks/validate-cli.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-833-prompt-agent-profile-fields/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-833`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- None (authoring docs land with SP-834 / SP-836)

**Check If Affected:**
- `skills/create-spine-tasks/references/prompt-template.md`

## Completion Criteria

- [ ] Three fields parsed and validated; planner and queue paths unaffected
- [ ] `spine tasks validate` and preflight reject unknown profiles and same-family reviewer pairings

## Git Commit Convention

- `feat(SP-833): parse and validate per-task Profile/Thinking/Reviewer Profile (#340, #355)`

## Do NOT

- Change worker or reviewer spawns (SP-834 / SP-835)
- Change existing `**Type:**` / `**Size:**` parsing
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
