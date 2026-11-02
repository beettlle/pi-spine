# Task: SP-852 — Worker rules loader skips an oversize rule and keeps loading

**Created:** 2026-11-01
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Every worker prompt goes through this loader. Getting the cap math wrong either exceeds the 32 KB budget or keeps dropping rules.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `loadContextDocEntries` (`src/config/worker-context.mjs` ~75-125) walks selected rule paths in order; the first time `totalBytes + size > byteCap` (~100, `DEFAULT_WORKER_CONTEXT_BYTE_CAP = 32_768`) it returns with `truncated: true` and `"...remaining paths omitted (byte cap)"`. One oversize rule (e.g. `general-llm-anti-patterns.mdc`, 72.5 KB) drops every later rule, including small glob-matched ones (`engineering-philosophy.mdc`, 12.8 KB, in the #337 example). `buildReviewerContext` (`src/config/reviewer-context.mjs` ~173) calls the same loader with a 16 KiB cap.

## Mission

Closes #337 — A rule that cannot fit is skipped; later rules that fit still load:

1. `loadContextDocEntries` skips any path whose size would exceed the remaining budget, records `{ path, reason: "byte_cap", sizeBytes }` in `skipped`, and continues. `truncated` is `true` when anything was skipped for the cap. The text marker names the skipped paths instead of "remaining paths omitted".
2. Existing skip reasons (neverLoad, missing file) keep their behavior and appear in `skipped` with their own reason.
3. Tests (worker and reviewer caps): oversize first, oversize in the middle, all fit.

## Dependencies

- **None**

## Context to Read First

- GitHub #337
- `src/config/worker-context.mjs` 20-130
- `src/config/reviewer-context.mjs` 160-244 (second caller)
- `tests/config/worker-context.test.mjs`, `tests/config/reviewer-context.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio + OpenJev for the stet `reviewCommand` only
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/config/worker-context.mjs` — 404 lines; net change ≤ +20
- `tests/config/worker-context.test.mjs`
- `tests/config/reviewer-context.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/config/worker-context.test.mjs tests/config/reviewer-context.test.mjs tests/batch/worker-prompt-rules.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-852` |
| fileScopeMustChange | `src/config/worker-context.mjs`, `tests/config/worker-context.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `loadContextDocEntries`; report the blast radius in STATUS
- [ ] `rg -n "remaining paths omitted|truncated" tests/` — list assertions that change

### Step 1: Skip and continue

- [ ] Oversize path skipped with reason `byte_cap`; loop continues
- [ ] `truncated` and marker text reflect skipped paths

**Artifacts:**
- `src/config/worker-context.mjs` (modified)

### Step 2: Tests

- [ ] Oversize first / middle / all fit, at worker and reviewer caps
- [ ] `skipped` lists path, reason, size

**Artifacts:**
- `tests/config/worker-context.test.mjs`, `tests/config/reviewer-context.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-852-worker-rules-skip-oversize/.DONE`

**Stet review (Contract `reviewCommand`, blocking):** fix real defects in this task's diff. For a stet false positive, `stet dismiss <id> <reason>` citing lint/typecheck/test evidence, record it under Discoveries, and file it at https://github.com/beettlle/stet/issues. Never edit `.review/` or remove the `reviewCommand`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/design/cursor-rules-discovery.md` byte-cap description (SP-855 owns this file this release; note in Discoveries)

## Completion Criteria

- [ ] One oversize rule no longer drops later rules that fit

## Git Commit Convention

- `fix(SP-852): worker rules loader skips oversize rules and continues`

## Do NOT

- Change `DEFAULT_WORKER_CONTEXT_BYTE_CAP` or the reviewer cap
- Change rule selection or ordering (SP-853 owns journaling; profile changes are #344)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
