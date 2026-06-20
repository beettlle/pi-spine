# Task: SP-312 — run-metrics.jsonl init gitignore

**Created:** 2026-06-19
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** `spine init` omits `run-metrics.jsonl` from recommended gitignore; once tracked, preflight `git-clean` fails on every batch even after manual `.gitignore` entry.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #16**: `.spine/run-metrics.jsonl` appended during batches breaks repeated `spine preflight` with `git-clean: working tree has 1 uncommitted change(s)` when the file was previously committed.

**Required behavior:**

1. **`spine init`:** Add `.spine/run-metrics.jsonl` to `SPINE_GITIGNORE_ENTRIES` alongside `batch-state.json` and `runtime/`.
2. **Preflight:** Treat metrics-file-only dirty state like rules-manifest `generatedAt` drift — ignore for `git-clean` when the only dirty path is the configured metrics path and content is append-only runtime data (or file is gitignored but still tracked: document `git rm --cached` in doctor hint).
3. **Doctor:** Warn when `run-metrics.jsonl` is tracked by git (`git ls-files`) with fix command.
4. **Integrate:** Ensure integrate path never stages metrics file (verify; fix if found).

**Closes:** [#16](https://github.com/beettlle/pi-spine/issues/16)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #16
- `src/config/spine-init-constants.mjs` — `SPINE_GITIGNORE_ENTRIES`, `ensureGitignoreEntries`
- `src/config/spine-preflight-lib.mjs` — `checkGitClean`, rules-manifest drift exception
- `src/doctor/run-doctor-checks.mjs` — gitignore entry checks
- `docs/PRD-v1.3-upstream-execution-bridge.md` — metrics path documented as ignored

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/config/spine-init-constants.mjs`
- `src/config/spine-preflight-lib.mjs`
- `src/doctor/run-doctor-checks.mjs`
- `tests/config/spine-init-gitignore.test.mjs` (new or extend existing)
- `tests/config/spine-preflight.test.mjs` (extend if present)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/config/spine-init-gitignore.test.mjs tests/config/spine-preflight.test.mjs` |
| fileScopeMustChange | `src/config/spine-init-constants.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm `SPINE_GITIGNORE_ENTRIES` lacks `run-metrics.jsonl` today
- [ ] Confirm pi-spine repo `.gitignore` already lists `.spine/run-metrics.jsonl`
- [ ] Read rules-manifest preflight drift pattern in `spine-preflight-lib.mjs`

### Step 1: Init gitignore + preflight + doctor

- [ ] Add `.spine/run-metrics.jsonl` to `SPINE_GITIGNORE_ENTRIES`
- [ ] Extend `checkGitClean` to ignore metrics-only dirty when path matches `config.metrics.path`
- [ ] Add doctor check: warn if metrics file is git-tracked; suggest `git rm --cached`

### Step 2: Testing & Verification

- [ ] Test: `ensureGitignoreEntries` adds run-metrics path on fresh init
- [ ] Test: preflight passes with only metrics file dirty (gitignored)
- [ ] Test: doctor warns when metrics file is tracked
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Update `docs/adoption/operator-runbook.md` metrics section if preflight/doctor behavior changed
- [ ] Close issue #16 (`gh issue close 16`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — metrics gitignore / tracked-file workaround (if not already covered)

**Check If Affected:**

- `docs/adoption/bootstrap-checklist.md` — init gitignore list

## Completion Criteria

- [ ] `spine init` adds run-metrics to gitignore on new projects
- [ ] Preflight does not block on append-only metrics dirty state
- [ ] Doctor surfaces tracked-metrics remediation
- [ ] Tests pass with coverage gate
- [ ] Issue #16 closed

## Git Commit Convention

- `feat(SP-312): complete Step N — description`
- `fix(SP-312): description`
- `test(SP-312): description`

## Do NOT

- Delete or truncate existing `run-metrics.jsonl` in consumer repos
- Skip preflight when non-metrics paths are dirty
- Commit metrics file during integrate

---

## Amendments (Added During Execution)
