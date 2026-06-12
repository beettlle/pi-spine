# Task: SP-232 — Pin agent models from spine-config (Option A)

**Created:** 2026-06-12
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Real-pi batches inherit pi global model selection (`pi-lmstudio` → `http://127.0.0.1:1234`); spine-config `agents.*.model: inherit` does not pin workers. Operator incident during SP-205–225 stress test (B2/B3).
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **Option A**: honor `.spine/spine-config.json` `agents.worker` and `agents.reviewer` model pins when spine spawns `pi -p`, so real-pi batches do not silently inherit a local LM Studio / OpenAI-compatible selection from `~/.pi/agent`.

**Incidents (2026-06-12 stress test):**
- B2 (`SP-214`, batch `20260612T211613`): pi session switched to `lmstudio/qwen/qwen3-coder-next`; worker failed with LM Studio backend errors (`libpython3.11.dylib`, `Model unloaded`).
- B3 (`SP-215–219`, batch `20260612T215847`): four-lane parallel start succeeded; engine code review spawns hit same LM Studio model load failures.
- Spine doctor reported `cursor/auto` while workers used LM Studio because `agents.worker.model` is `inherit` and worker runner never passes `--model`.

**Required behavior:**
1. When `agents.worker.model` is set and not `inherit`, `bin/spine-worker-runner.mjs` passes `pi --model <value>` (support `provider/id` form, e.g. `cursor/auto`).
2. Review spawns already honor `agents.reviewer.model` in `src/batch/review.mjs` — verify parity; fix gaps (e.g. missing `--thinking` if config specifies it and pi CLI supports it).
3. Default greenfield template recommends explicit pins for real-pi operators: `cursor/auto` for worker and reviewer (keep `inherit` documented as opt-in for advanced/local-model users).
4. Operator runbook: document that `inherit` delegates to pi global settings (`~/.pi/agent/settings.json`, installed packages like `pi-lmstudio`); pinned models avoid accidental local server use.
5. Optional doctor **warning** (not fail): when `agents.worker.model === "inherit"` and `pi-lmstudio` package is listed in pi settings — headline only, link to runbook.

## Dependencies

- **Task:** SP-212
- **Task:** SP-088

## Context to Read First

**Tier 3:**
- `bin/spine-worker-runner.mjs` — pi spawn args (~lines 208–242)
- `src/batch/review.mjs` — `spawnReviewerPi` model/thinking args (~lines 580–596)
- `src/batch/worker-host.mjs` — `buildWorkerChildEnv` (env inheritance)
- `templates/spine-config.json` — default `agents.*.model`
- `tests/config/settings-fields.test.mjs` — valid model values
- `docs/adoption/operator-runbook.md` — real-pi worker section
- Incident logs: `.spine/runtime/20260612T211613/lanes/lane-1/worker-output-SP-214.log`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests stub pi spawn)

## File Scope

- `bin/spine-worker-runner.mjs`
- `src/batch/review.mjs` (only if reviewer/thinking parity gap found)
- `templates/spine-config.json`
- `bin/spine-doctor.mjs` (optional warning check)
- `tests/batch/worker-model-pin.test.mjs` (new)
- `docs/adoption/operator-runbook.md`
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `bin/spine-worker-runner.mjs`, `tests/batch/worker-model-pin.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Confirm reviewer path already passes `--model` when not `inherit`
- [ ] Reproduce worker runner omits `--model` today (grep / small unit test)

### Step 1: Worker model pin

> **Plan-review checkpoint**

- [ ] Extract shared helper (e.g. `buildPiModelArgs(config, role)`) or inline consistently in worker runner
- [ ] Pass `--model` from `agents.worker.model` when not `inherit` / empty
- [ ] Pass `--thinking` from `agents.worker.thinking` when pi CLI supports it and value is set

### Step 2: Defaults & docs

- [ ] Update `templates/spine-config.json` defaults to `cursor/auto` for worker + reviewer (document `inherit` in runbook)
- [ ] Runbook subsection: pi model inheritance vs spine pins; LM Studio / `127.0.0.1:1234` troubleshooting
- [ ] Optional doctor warning for inherit + pi-lmstudio

### Step 3: Testing & Verification

- [ ] Unit test: worker runner argv includes `--model cursor/auto` when configured
- [ ] Unit test: `inherit` omits `--model`
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Append resolved entry to `findings.md` (scheduler tag: operator / real-pi)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Real-pi worker spawn respects spine-config model pin without requiring pi TUI model change
- [ ] Template + runbook guide operators away from accidental LM Studio inheritance
- [ ] Tests green; coverage ≥77%

## Git Commit Convention

- `feat(SP-232): complete Step N — description`

## Do NOT

- Remove `inherit` as a valid setting (advanced/local-model use case)
- Hard-code LM Studio URLs in spine (pi package owns that)
- Change stub worker behavior beyond argv construction tests

---

## Amendments (Added During Execution)
