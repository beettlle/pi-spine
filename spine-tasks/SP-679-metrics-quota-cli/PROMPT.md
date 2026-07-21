# Task: SP-679 — spine metrics quota CLI

**Created:** 2026-07-20
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** New CLI subcommand over SP-678 snapshot; touches `bin/spine.mjs`.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Partial #220 — Add `spine metrics quota` that builds the SP-678 snapshot, writes timestamped JSON under `.spine/reports/` (create dir as needed), supports `--json` for automation, and optional `--open` for HTML when SP-680 artifact exists (or stub flag documented if HTML lands after). Do not leak secrets.

## Dependencies

- **Task:** SP-678 (snapshot builder required)
- **Task:** SP-677 (`bin/spine.mjs` metrics command extended first — avoid conflicting edits)

## Context to Read First

- `src/metrics/quota-snapshot.mjs`
- `bin/spine.mjs` — `cmdMetrics`
- GitHub #220 CLI acceptance
- `Parent split: SP-678 — snapshot builder`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine.mjs`
- `src/metrics/quota-cli.mjs`
- `tests/metrics/quota-cli.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/metrics/quota-cli.test.mjs` |
| fileScopeMustChange | `src/metrics/quota-cli.mjs`, `tests/metrics/quota-cli.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-678 + SP-677 on `main`
- [ ] Decide report filename pattern under `.spine/reports/`

### Step 1: CLI module

- [ ] Implement `src/metrics/quota-cli.mjs` wrapping snapshot build + JSON write
- [ ] `--json` prints snapshot to stdout; default writes file + short human summary
- [ ] Ensure `.spine/reports/` is gitignored or reports are clearly runtime artifacts

### Step 2: Wire bin

- [ ] Extend `cmdMetrics` to accept `quota` subcommand
- [ ] Update help text
- [ ] Tests/smoke for subcommand dispatch

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — SP-682

## Completion Criteria

- [ ] `spine metrics quota` works offline from config + metrics
- [ ] Partial #220 CLI complete

## Do NOT

- Call live provider APIs here (SP-681)
- Commit secrets or prompt bodies into reports
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-679): spine metrics quota CLI (#220)`

## Amendments

- **2026-07-21 (pre-landed salvage):** `bin/spine.mjs` already changed on `main` for SP-677 usage rollups. Redirected `fileScopeMustChange` to new `quota-cli` module + tests; still wire `cmdMetrics` quota subcommand in `bin/spine.mjs` as needed for the CLI.
