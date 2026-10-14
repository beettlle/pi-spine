# Task: SP-827 — Execute tasks run at effective Review Level 0

**Created:** 2026-10-10
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** `readReviewLevel` gates every engine review phase, resume path, worker review hint, and run-metrics `reviewLevel`. A wrong result on `llm` packets would silently skip their reviews.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** Operator runbook §2.5 says execute-only tasks do not run plan, code, or final review. The engine does not implement that: `runNonMatrixTaskOnLane` calls the plan, code, and final review phases after every worker (`src/batch/engine-lanes.mjs` ~392–442), and each phase gates only on `readReviewLevel(taskFolder)` (`src/batch/review-artifacts.mjs` 13–17) → `isReviewTypeRequired` (`src/batch/review-shared.mjs` 24–29). Neither looks at `**Type:** execute`. An execute packet at Review Level 1 therefore spawns a plan reviewer and a final reviewer to judge a shell command. Fixing `readReviewLevel` once fixes every caller (engine phases, `review-step-run.mjs`, resume paths, `metrics.mjs`, worker runner, agentSession worker).

## Mission

Closes #336 — Execute tasks get an effective Review Level of 0; authors are warned when they declare more.

1. **Helper** — new `src/batch/review-level-effective.mjs` exporting `effectiveReviewLevel(markdown)`: returns `0` when `parsePrompt(markdown).type === "execute"` (`src/tasks/packet/parse-prompt.mjs`; reuse it — do not copy the `**Type:**` regex), otherwise `parseReviewLevel(markdown)` (`src/batch/review-shared.mjs`). The new file must be typed: **no** `// @ts-nocheck` (`tests/arch/ts-nocheck-guard.test.mjs` rejects new entries).
2. **Wire** — `readReviewLevel` in `src/batch/review-artifacts.mjs` returns `effectiveReviewLevel(...)` instead of `parseReviewLevel(...)`. That file is at 497 lines; net change ≤ 3 lines (modules stay ≤ 500).
3. **Validate warning** — `collectExecuteReviewLevelWarnings({ type, reviewLevel })` in `src/tasks/validate-contract-warn.mjs` returns one warning (not an error) when `type === "execute"` and `reviewLevel > 0`, e.g. `Type: execute task declares Review Level N; execute tasks run no reviewers — set Review Level 0.` Call it from `validatePrompt` in `src/tasks/packet/validate-prompt.mjs` with `structure.prompt.type` and the **declared** level (`parseReviewLevel(markdown)`) and append to the returned `warnings`.
4. **Tests** — new `tests/batch/review-level-execute.test.mjs`:
   - `readReviewLevel` on temp task folders: `llm` (no Type line) at 0/1/2 → 0/1/2; `**Type:** execute` at 0/1/2 → 0/0/0; `**Type:** llm` explicit at 2 → 2.
   - `isReviewTypeRequired(readReviewLevel(folder), t)` is `false` for plan/code/final on an execute packet at Level 2.
   - `validatePrompt` on a valid execute packet at Level 1 → `ok: true`, one warning containing `Review Level`; at Level 0 → no such warning; `llm` packet at Level 2 → no such warning.

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh default SP-827`, which reviews this task's diff with stet (`.review/config.toml`: `qwen/qwen3.8-27b` on LM Studio with the OpenJev critic). When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. Record stet reviewer bugs (invented syntax errors, stale hunks, parse failures) under Discoveries in STATUS.md. Never dismiss a real defect without fixing it. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Dependencies

- **Task:** SP-828 (stet contract script and review config used by this Contract)

## Context to Read First

- GitHub #336
- `src/batch/review-artifacts.mjs` 1–17; `src/batch/review-shared.mjs` 1–30
- `src/tasks/packet/parse-prompt.mjs` 160–247 (`parsePrompt`, `validatePrompt` execute check)
- `src/tasks/packet/validate-prompt.mjs` 20–56; `src/tasks/validate-contract-warn.mjs`
- `docs/adoption/operator-runbook.md` §2.5 (read only)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) and OpenJev System One at `http://127.0.0.1:8080`, for the stet step of the Contract only (unit tests need neither)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/review-level-effective.mjs`
- `src/batch/review-artifacts.mjs`
- `src/tasks/validate-contract-warn.mjs`
- `src/tasks/packet/validate-prompt.mjs`
- `tests/batch/review-level-execute.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/review-level-execute.test.mjs tests/tasks/validate-contract-warn.test.mjs tests/tasks/validate-prelanded-contract.test.mjs tests/tasks/phase20-fixtures.test.mjs tests/batch/review-honor-guard.test.mjs tests/batch/execution-only.test.mjs tests/arch/ts-nocheck-guard.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh default SP-827` |
| fileScopeMustChange | `src/batch/review-level-effective.mjs`, `src/batch/review-artifacts.mjs`, `tests/batch/review-level-execute.test.mjs` |
| fileScopeMustNotChange | `.review/**` |
| artifactsMustExist | `src/batch/review-level-effective.mjs`, `tests/batch/review-level-execute.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `readReviewLevel` and `validatePrompt` (`src/tasks/packet/validate-prompt.mjs`) — record callers and risk in Discoveries
- [ ] `rg -n 'readReviewLevel|Review Level' tests/ | rg -i execute` — any test expecting reviews on execute packets is in the Contract run (record in Amendments if a file outside File Scope must change)
- [ ] Dependencies satisfied

### Step 1: Effective level

- [ ] `effectiveReviewLevel` in the new typed module
- [ ] `readReviewLevel` uses it (net ≤ 3 lines in `review-artifacts.mjs`)

**Artifacts:**
- `src/batch/review-level-effective.mjs` (new)
- `src/batch/review-artifacts.mjs` (modified)

### Step 2: Validate warning

- [ ] `collectExecuteReviewLevelWarnings` helper
- [ ] Wired into `validatePrompt` warnings

**Artifacts:**
- `src/tasks/validate-contract-warn.mjs` (modified)
- `src/tasks/packet/validate-prompt.mjs` (modified)

### Step 3: Tests

- [ ] `readReviewLevel` and `isReviewTypeRequired` cases
- [ ] `validatePrompt` warning cases

**Artifacts:**
- `tests/batch/review-level-execute.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-827-execute-effective-review-level/.DONE` (this task folder, not the worktree root)

## Documentation Requirements

**Must Update:**
- None (runbook §2.5 already describes the intended behavior)

**Check If Affected:**
- None

## Completion Criteria

- [ ] Execute packet with Review Level 1 or 2 → `readReviewLevel` returns 0, so no engine review phase runs
- [ ] `llm` packets return their declared level unchanged
- [ ] `spine tasks validate` warns (does not fail) on execute + Review Level > 0

## Git Commit Convention

- `fix(SP-827): execute tasks run at effective Review Level 0 (#336)`

## Do NOT

- Edit `src/batch/engine-lanes.mjs`, `src/batch/engine-lanes/review-*.mjs`, or `src/batch/review-shared.mjs` — the fix is in `readReviewLevel` only
- Change `parsePrompt` / `validatePrompt` in `parse-prompt.mjs`, or turn the warning into an error
- Edit `docs/adoption/operator-runbook.md`
- Run the full suite (`npm test`, `npm run coverage:check`) — post-integrate `release:check` owns it
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-10-11 (operator, SP-828 stet adoption):** Contract `testCommand` ends with `bash scripts/spine-stet-contract-run.sh default`; added `fileScopeMustNotChange` `.review/**`, the LM Studio and OpenJev services, the stet triage paragraph in Mission, and the dependency on SP-828.
- **2026-10-14 (operator, wave 1 stet recovery):** The Contract passes this task's ID to `spine-stet-contract-run.sh`, so stet reviews only this task's commits when another task ran first on the same lane. The lane-commit sanitizer deletes `.review/` session state between serialized tasks.
