# Task: SP-832 — Reviewer profile resolution and model-family guard

**Created:** 2026-10-17
**Size:** M

## Review Level: 1 (Plan Only)

**Risk:** Changes how every reviewer spawn picks its model. A wrong precedence silently reviews with the wrong model; a too-strict family check blocks every batch at preflight.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `resolveReviewerModelPin` / `resolveReviewerThinkingPin` (`src/config/agent-model-resolve.mjs` 11-49) read only `config.agents.reviewer[type]` then `config.agents.reviewer`. `applyActiveAgentProfile` (`src/config/spine-config-load.mjs` 101-122) has already merged the active profile's `reviewer` block into `agents.reviewer`. There is no way to pick a reviewer from another profile, and nothing stops a worker and its reviewer from coming from the same model family (today `quotaFallbackProfile: gemini4` puts a `google/gemini-4-argon` worker under a `google/gemini-2.5-pro` reviewer). Review Level stays 1 (not 2) because engine code review is broken until #343 lands (SP-840).

## Mission

Partial #355 — Add a pure reviewer-resolution layer with a precedence order and a model-family guard, validate the new config keys, and report effective pairings in `spine doctor` / preflight. No engine wiring in this task (SP-834 does that).

1. **Model family helper** — new `src/config/model-family.mjs` exporting `resolveModelFamily(model)`:
   - Match on the model name after the `provider/` prefix first: `gemini*` → `"gemini"`, `claude*` → `"claude"`, `glm*` → `"glm"`, `kimi*` or `k<digit>*` → `"kimi"`, `gpt*` / `o<digit>*` → `"gpt"`, `qwen*` → `"qwen"`.
   - Otherwise fall back on provider: `google` → `"gemini"`, `anthropic` → `"claude"`, `zai` → `"glm"`, `kimi-coding` → `"kimi"`.
   - Anything else (including `cursor/auto`, `inherit`, `null`) → `"unknown"`. `"unknown"` never equals another family (a pairing with an unknown side is allowed).
   - Export `isSameModelFamily(a, b)` that returns true only when both families are known and equal.
2. **Reviewer resolution** — in `src/config/agent-model-resolve.mjs` add `resolveEffectiveReviewer(config, { promptReviewerProfile, workerProfile, workerModel })` returning, per review type (`plan`, `code`, `final`): `{ model, thinking, profile, source }`, plus `warnings: string[]` and `blocked: Array<{ reviewType, reason }>`.
   - Candidate order (first usable wins): (1) `promptReviewerProfile`; (2) `agents.profiles[workerProfile].reviewerProfile`; (3) `agents.reviewerProfile`; (4) the already-merged `agents.reviewer` block (`source: "agents.reviewer"`).
   - A named profile that does not exist is an error for the caller (return it in `blocked` with reason `unknown_reviewer_profile`). A named profile that exists but has no `reviewer` block is skipped with a warning (`reviewer profile "<name>" has no reviewer block; falling back`).
   - Per type, read `profile.reviewer[type].model` then `profile.reviewer.model` (same `inherit` / `off` rules as the existing pin resolvers).
   - **Family guard:** when `isSameModelFamily(candidateModel, workerModel)` is true, skip that candidate for that review type with a warning and try the next. When no candidate is cross-family, add `{ reviewType, reason: "same_model_family" }` to `blocked` and return the last candidate's pins unchanged so callers can report them.
   - Keep `resolveReviewerModelPin` / `resolveReviewerThinkingPin` signatures and behavior unchanged (existing callers keep working).
3. **Config schema** — `src/config/spine-config-schema.mjs` (`validateAgentProfilesConfig` ~273-400): validate `agents.reviewerProfile` (string naming a defined profile, same membership rule as `quotaFallbackProfile` ~337-359) and `agents.profiles.<name>.reviewerProfile` (string naming a defined profile; a profile may not name itself). Add `agents.reviewerProfile` to `src/config/settings-fields.mjs` so `spine settings set agents.reviewerProfile <name>` works.
4. **Doctor and preflight** — in `src/doctor/agent-model-inherit.mjs`, change `buildReviewerPerTypePinsDoctorCheck` (~106-112) to report the effective reviewer for each worker pairing: the active profile, `quotaFallbackProfile`, and `escalatePolicy.toProfile` (when set). Detail per pairing: `<profile>: worker=<model> → plan=<m>/<t>, code=<m>/<t>, final=<m>/<t>`. The check fails (`ok: false`) with suggested command `spine settings set agents.reviewerProfile <name>` when any pairing has a `blocked` entry; warnings stay `ok: true, warning: true`. Register the same check in preflight next to the existing reviewer-pin check so a same-family pairing blocks `spine preflight` (find the registration with `rg -n 'reviewer model pins' src`).

## Dependencies

- **None**

## Context to Read First

- GitHub #355 (body and the maintainer comment with suggested values)
- `src/config/agent-model-resolve.mjs` (whole file)
- `src/config/spine-config-load.mjs` 45-125 (`AGENT_SECTIONS`, `applyActiveAgentProfile`)
- `src/config/spine-config-schema.mjs` 190-400
- `src/config/settings-fields.mjs` 60-160
- `src/doctor/agent-model-inherit.mjs` (whole file); `src/doctor/run-doctor-checks.mjs` ~455-470
- `src/metrics/quota-snapshot.mjs` 25-50 (`resolvePoolId`, provider-keyed — do not reuse for family)
- `tests/batch/reviewer-model-resolve.test.mjs`, `tests/doctor/agent-model-inherit.test.mjs`, `tests/config/load.test.mjs` 75-160

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/config/model-family.mjs`
- `src/config/agent-model-resolve.mjs`
- `src/config/spine-config-schema.mjs`
- `src/config/settings-fields.mjs`
- `src/doctor/agent-model-inherit.mjs`
- `src/config/spine-preflight-lib.mjs`
- `tests/config/model-family.test.mjs`
- `tests/batch/reviewer-model-resolve.test.mjs`
- `tests/doctor/agent-model-inherit.test.mjs`
- `tests/config/load.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/config/model-family.test.mjs tests/batch/reviewer-model-resolve.test.mjs tests/doctor/agent-model-inherit.test.mjs tests/config/load.test.mjs tests/spine-preflight.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-832` |
| fileScopeMustChange | `src/config/model-family.mjs`, `src/config/agent-model-resolve.mjs`, `src/config/spine-config-schema.mjs`, `tests/config/model-family.test.mjs`, `tests/batch/reviewer-model-resolve.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `resolveReviewerModelPin`, `resolveReviewerThinkingPin`, `validateAgentProfilesConfig`, `buildReviewerPerTypePinsDoctorCheck` — record callers in Discoveries
- [ ] Locate the preflight registration for the reviewer-pin check and record it

### Step 1: Model family + reviewer resolution

- [ ] `src/config/model-family.mjs` with `resolveModelFamily` / `isSameModelFamily`
- [ ] `resolveEffectiveReviewer` with candidate order, missing-block warning, unknown-profile block, family guard

**Artifacts:**
- `src/config/model-family.mjs` (new)
- `src/config/agent-model-resolve.mjs` (modified)

### Step 2: Schema + settings

- [ ] `agents.reviewerProfile` and `profiles.<name>.reviewerProfile` validated (unknown name and self-reference rejected)
- [ ] `agents.reviewerProfile` settable via `spine settings set`

**Artifacts:**
- `src/config/spine-config-schema.mjs` (modified)
- `src/config/settings-fields.mjs` (modified)

### Step 3: Doctor + preflight pairing report

- [ ] Doctor detail lists every worker pairing (active, quota fallback, escalate target)
- [ ] Same-family pairing fails the doctor check and preflight

**Artifacts:**
- `src/doctor/agent-model-inherit.mjs` (modified)
- `src/config/spine-preflight-lib.mjs` (modified, only if registration lives there)

### Step 4: Tests

- [ ] Family table: `google/gemini-2.5-pro`, `google/gemini-4-argon`, `anthropic/claude-sonnet-5-5`, `zai/glm-5.3-flash`, `kimi-coding/k3`, `cursor/auto`, `cursor/gemini-3.1-pro`, `llama.cpp/qwen3.8-flash-next-iq3_s`, `inherit`, `null`
- [ ] Precedence: PROMPT > worker profile `reviewerProfile` > `agents.reviewerProfile` > `agents.reviewer`, per review type
- [ ] Missing `reviewer` block warns and falls back; unknown profile is blocked
- [ ] Family guard skips a same-family candidate and blocks when none is cross-family
- [ ] Schema rejects unknown / self-referencing `reviewerProfile`
- [ ] Doctor detail and failure for a `gemini` worker paired with a `gemini` reviewer

### Step 5: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission note below)
- [ ] Fix all failures

### Step 6: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-832-reviewer-profile-resolution/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-832`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- None (operator docs land with SP-834)

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] `resolveEffectiveReviewer` implements the precedence and family guard with unit tests
- [ ] Config keys validated; doctor and preflight report effective pairings and fail on same-family pairings
- [ ] Existing reviewer pin tests pass unchanged

## Git Commit Convention

- `feat(SP-832): reviewer profile resolution and model-family guard (#355)`

## Do NOT

- Wire the resolver into engine review spawns (SP-834)
- Parse PROMPT fields (SP-833)
- Change `applyActiveAgentProfile` merge semantics
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
