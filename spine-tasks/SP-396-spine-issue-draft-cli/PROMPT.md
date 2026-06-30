# Task: SP-396 — spine issue draft CLI

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Thin CLI wrapper over SP-395; optional gh integration; issue #60 Tier 1c.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #60** Tier 1c: wire `spine issue draft` CLI calling `buildIssueDraftBody` from SP-395.

**Usage:**

```bash
spine issue draft [--type bug|enhancement|question] [--title TITLE] [--json] [--out PATH] [--create]
```

**Behavior:**

| Flag | Default | Behavior |
|------|---------|----------|
| `--type` | `bug` | Passed to `buildIssueDraftBody` |
| `--title` | auto from diagnosis headline | Override issue title |
| `--json` | off | Print `{ title, body, labels, draftPath? }` |
| `--out PATH` | `.spine/issue-draft.md` | Write markdown body to file |
| `--create` | off | Run `gh issue create --title … --body-file … --label …`; fail clearly if `gh` missing |

Human-readable default: print title + body to stdout; write `--out` unless `--json` only.

## Dependencies

- **Task:** SP-395 (`buildIssueDraftBody` exists)

## Context to Read First

- GitHub issue #60
- `src/cli/issue-draft.mjs`
- `bin/spine-handoff.mjs` or `src/cli/handoff.mjs` CLI patterns
- `bin/spine.mjs` subcommand wiring

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (`--create` needs `gh` on PATH)

## File Scope

- `bin/spine-issue.mjs`
- `bin/spine.mjs`
- `tests/cli/spine-issue.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/spine-issue.test.mjs` |
| fileScopeMustChange | `bin/spine-issue.mjs,bin/spine.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/cli/spine-issue.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read SP-395 exports
- [ ] Read `bin/spine.mjs` handoff/watch subcommand pattern

### Step 1: CLI implementation

- [ ] Add `bin/spine-issue.mjs` with flag parsing and draft output
- [ ] Wire `case "issue"` in `bin/spine.mjs` help + dispatch
- [ ] `--create` spawns `gh issue create` with label from draft; no `--create` by default

### Step 2: Testing & Verification

- [ ] CLI integration test: draft writes file, `--json` shape, `--create` skipped when gh absent (mock or guard)
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Add one-line help in `bin/spine.mjs` usage block

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] `spine issue draft` works without batch context (idle repo ok)
- [ ] `--create` is opt-in and fails loud without `gh`

## Git Commit Convention

- `feat(SP-396): complete Step N — description`
- `test(SP-396): description`

## Do NOT

- Close GitHub issue #60 (SP-397)
- Auto-file issues without `--create`

---

## Amendments (Added During Execution)
