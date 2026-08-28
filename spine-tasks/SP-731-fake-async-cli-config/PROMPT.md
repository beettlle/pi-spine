# Task: SP-731 — Remove fake-async in CLI, config, and analyze

**Created:** 2026-08-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Sync/async cleanup across CLI and config helpers; low security impact; callers may need signature updates.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Partial #270 — Remove `async` from functions that execute synchronously (no `await`) in CLI and config paths: `runJournalFollow`, `runSpineSettingsSlash`, `runLaneLogs`, `analyzeTasksScope`, and `buildWorkerContextAsync`. Prefer removing `async` unless real non-blocking I/O is warranted (e.g. convert to `fs.promises` only when call sites benefit).

## Dependencies

- **None**

## Context to Read First

- GitHub #270 — fake-async inventory table
- `src/cli/journal-follow.mjs`, `src/cli/lane-logs.mjs`, `src/cli/settings-slash.mjs`
- `src/tasks/analyze/index.mjs`, `src/config/worker-context.mjs`
- `javascript-3-brutal-audit.mdc` Rule A1

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/cli/journal-follow.mjs`
- `src/cli/lane-logs.mjs`
- `src/cli/settings-slash.mjs`
- `src/tasks/analyze/index.mjs`
- `src/config/worker-context.mjs`
- `tests/cli/journal-follow.test.mjs`
- `tests/cli/lane-logs.test.mjs`
- `tests/config/worker-context.test.mjs`
- `tests/tasks/analyze-cli.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/cli/journal-follow.test.mjs tests/cli/lane-logs.test.mjs tests/config/worker-context.test.mjs tests/tasks/analyze-cli.test.mjs` |
| fileScopeMustChange | `src/cli/journal-follow.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #270 acceptance criteria for the five listed functions
- [ ] `rg 'await (runJournalFollow|runLaneLogs|runSpineSettingsSlash|analyzeTasksScope|buildWorkerContextAsync)' src tests` — note callers

### Step 1: Remove fake-async (sync path)

- [ ] Drop `async` (or add real `await` for I/O) on each listed export
- [ ] Update caller signatures / JSDoc `@returns` where needed
- [ ] Preserve observable behavior (no semantic changes beyond sync vs microtask)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures from scoped tests

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**

- `docs/adoption/operator-runbook.md` — only if CLI behavior docs mention async follow paths

## Completion Criteria

- [ ] All five exports are sync or contain real `await`
- [ ] Scoped tests pass
- [ ] `.DONE` created

## Do NOT

- Change batch engine paths (SP-732 owns `mergeWaveLanesToOrch`, `skipTaskDoneOnDisk`, `spawnReviewerPi`)
- Add CI fake-async guard (optional follow-up in SP-732)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `fix(SP-731): remove fake-async in CLI/config (#270)`
