# Task: SP-639 — Evidence scripts executor

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Reuse validated scripts/ sandbox for gate evidence; additive path.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

**Partial:** [#160](https://github.com/beettlle/pi-spine/issues/160) — **Phase A only** (Phases B/C deferred)

If `testing.build` / `testing.test` / `testing.testWithCoverage` resolves to a path under `scripts/`, run it through the same validated-script sandbox already used by `development.workerLaunchScript` / worktree setup hooks (relative, under `scripts/`, no traversal). This unblocks stet and other external CLIs via wrapper scripts without enabling shell metacharacters in config strings.

**Source:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../docs/PRD-v2.6.0-consumer-resume-handoff.md) §6 FR-REL260-05

## Dependencies

- **Task:** SP-638 (evidence-command allowlist changes land first — same hot file)

## Context to Read First

- `src/batch/evidence-command.mjs`
- `src/config/worker-launch-script.mjs` — validation pattern
- `src/config/worktree-setup-hook.mjs`
- `tests/batch/evidence.test.mjs`
- GitHub #160

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/evidence-command.mjs`
- `tests/batch/evidence.test.mjs`
- `templates/spine-config.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/evidence.test.mjs` |
| fileScopeMustChange | `src/batch/evidence-command.mjs`, `tests/batch/evidence.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-638 landed; review worker-launch-script validation helpers
- [ ] Decide reuse vs thin wrapper for scripts/ evidence paths

### Step 1: Scripts path executor

- [ ] Detect `scripts/…` evidence commands and validate like workerLaunchScript
- [ ] Execute via argv/execFile without shell metacharacter widening
- [ ] Unit tests for allow scripts/ + reject escape/traversal
- [ ] Update `templates/spine-config.json` comment or example only if needed for scripts/ evidence

### Step 2: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Run contract `testCommand` only (scoped) — do **not** run full `npm test` or `npm run coverage:check` in the lane (parallel waves overload the host; integrate / `npm run release:check` owns full suite + coverage)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (operator narrative in SP-641)

**Check If Affected:**
- `docs/stet-overview.md` — advisory only
- `docs/adoption/operator-runbook.md` — SP-641

## Completion Criteria

- [ ] `scripts/….sh` evidence commands run via validated path
- [ ] Phase B/C of #160 not implemented
- [ ] Partial #160 (Phase A) done

## Do NOT

- Enable `&&` / shell metacharacters in evidence config (Phase B)
- Add `testing.review` slot (Phase C)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-639): scripts/ executor for gate evidence (#160 Phase A)`
