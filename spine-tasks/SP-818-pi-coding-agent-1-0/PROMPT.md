# Task: SP-818 — Bump @earendil-works/pi-coding-agent dev pin to ^1.0.1

**Created:** 2026-10-03
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** A major-version peer bump. Extension tool schemas and the agentSession backend compile and test against it.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `devDependencies` pins `@earendil-works/pi-coding-agent` at `^0.87.1`; npm `latest` is `1.0.1` (2026-10-03). Release intake found no removed or renamed symbols among our imports (`extensions/spine/*.ts`, `src/batch/agent-session-worker.mjs`). `typebox` stays at 1.3.34. Four doc lines pin 0.87.1:
- `README.md` ~52
- `docs/release/npm-publish.md` ~110 and ~138
- `docs/adoption/operator-runbook.md` ~102

The `peerDependencies` range stays `*`. `pi.minPiVersion` (0.80.0) changes only if 1.0 requires a newer pi CLI at runtime.

## Mission

pi-spine develops and tests against `@earendil-works/pi-coding-agent@^1.0.1`, and the docs state that pin.

1. **Dependency:** `npm install -D @earendil-works/pi-coding-agent@^1.0.1`. This updates `package.json` and `package-lock.json`. Do not change `peerDependencies`.
2. **Fix-ups:** if `npm run typecheck` or the extension and agent-session tests fail, fix only the call sites in `extensions/spine/**` and `src/batch/agent-session-worker.mjs`. Record every API difference in Discoveries.
3. **minPiVersion:** check the 1.0.1 changelog/README for a pi CLI floor. Raise `pi.minPiVersion` only if one is stated. In that case also update the `pi --version` stubs in `.github/workflows/ci.yml` and `release.yml`, per `docs/release/npm-publish.md` ~140. Record the decision in Discoveries.
4. **Docs:** replace `^0.87.1` with `^1.0.1` at the four doc lines above. Keep the surrounding wording; the npm-publish line ~110 note about audit history may stay as history.

## Dependencies

- **Task:** SP-817 (both edit `package.json` / `package-lock.json`)

## Context to Read First

- `package.json` 62-85
- `extensions/spine/*.ts` imports; `src/batch/agent-session-worker.mjs` imports
- `docs/release/npm-publish.md` 100-145

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** npm registry access for `npm install`
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `package.json`
- `package-lock.json`
- `extensions/spine/**`
- `src/batch/agent-session-worker.mjs`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `README.md`
- `docs/release/npm-publish.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && ! grep -l '0\.87\.1' package.json README.md docs/adoption/operator-runbook.md && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/extensions/slash-commands-handlers.test.mjs tests/extensions/spine-orchestrate-slash.test.mjs tests/worker-tools/worker-tools-registration.test.mjs tests/agents/worker-runner.test.mjs` |
| fileScopeMustChange | `package.json`, `package-lock.json`, `README.md`, `docs/release/npm-publish.md`, `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] SP-817 landed (`package.json` has `picomatch`)
- [ ] Dependencies satisfied

### Step 1: Bump + fix-ups

- [ ] Dev pin `^1.0.1`; lockfile updated
- [ ] Typecheck / extension tests fixed (or no changes needed — record which)
- [ ] `minPiVersion` decision recorded

**Artifacts:**
- `package.json`, `package-lock.json` (modified); `extensions/spine/**`, `src/batch/agent-session-worker.mjs` (only if required)

### Step 2: Docs

- [ ] Four doc pins updated

**Artifacts:**
- `README.md`, `docs/release/npm-publish.md`, `docs/adoption/operator-runbook.md` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] `npm audit --omit=dev` still 0 high
- [ ] Run full suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `README.md`, `docs/release/npm-publish.md`, `docs/adoption/operator-runbook.md` (pin lines only)

**Check If Affected:**
- `.github/workflows/ci.yml`, `.github/workflows/release.yml` (only if `minPiVersion` changes)

## Completion Criteria

- [ ] Dev pin `^1.0.1`; typecheck and extension tests green
- [ ] Docs state `^1.0.1`

## Git Commit Convention

- `chore(SP-818): bump pi-coding-agent dev pin to ^1.0.1`

## Do NOT

- Change `peerDependencies` ranges or `typebox`
- Edit runbook sections other than the version-floor paragraph (SP-811 owns the quota-fallback section)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
