# Task: SP-674 — Gate testing.review evidence slot

**Created:** 2026-07-20
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Additive config + evidence collection path; reuses existing evidence-command executor.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

Closes #160 — Implement Phase C: optional `testing.review` evidence slot. When set, run the command through the same validated evidence executor as build/test (`scripts/` path or allowlisted argv/`&&` chains), write output to a stable evidence path (e.g. `evidence/review-output.txt` or `.json`), and include it in the gate evidence bundle refs so operators can attach stet (or similar) without per-task PROMPT edits.

## Dependencies

- **None**

## Context to Read First

- `src/batch/gate-evidence-collect.mjs`
- `src/batch/gate-evidence-read.mjs` — `resolveTestingCommands`
- `src/batch/evidence-command.mjs`
- `tests/batch/evidence.test.mjs`
- GitHub #160 Phase C acceptance criteria

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate-evidence-collect.mjs`
- `src/batch/gate-evidence-read.mjs`
- `src/config/settings-fields.mjs`
- `templates/spine-config.json`
- `tests/batch/evidence.test.mjs`
- `tests/batch/gate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/evidence.test.mjs tests/batch/gate.test.mjs` |
| fileScopeMustChange | `src/batch/gate-evidence-collect.mjs`, `src/batch/gate-evidence-read.mjs`, `tests/batch/evidence.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm Phase A/B already landed (`scripts/` executor + allowlisted `&&`)
- [ ] Inventory where testing commands are resolved and evidence refs assembled

### Step 1: Config + resolve review command

- [ ] Add `testing.review` to settings schema / defaults documentation surface as needed
- [ ] Extend `resolveTestingCommands` to return `review` when configured
- [ ] Update `templates/spine-config.json` with a commented or documented `review` example pointing at `scripts/` (no live stet dependency in template)

### Step 2: Collect review evidence

- [ ] In `collectExtendedEvidenceBundle`, when `testing.review` is set, run via `runEvidenceCommand` and write `evidence/review-output.txt` (preserve raw stdout/stderr)
- [ ] Append `evidence/review-output.txt` to `evidenceRefs`
- [ ] Fail closed on unsafe command strings (same validator as build/test)
- [ ] Unit tests: review slot runs; missing slot is no-op; unsafe path rejected

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only (scoped) — do **not** run full `npm test` or `npm run coverage:check` in the lane
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Leave operator narrative docs to SP-675 / SP-682

## Documentation Requirements

**Must Update:**
- None (operator docs in SP-675 / SP-682)

**Check If Affected:**
- `docs/stet-overview.md` — SP-675
- `docs/QUICK-REFERENCE.md` — SP-682

## Completion Criteria

- [ ] `testing.review` evidence appears in gate bundle when configured
- [ ] Closes #160 Phase C engine work (script/docs may land in SP-675)
- [ ] Existing build/test evidence paths unchanged

## Do NOT

- Require stet binary in CI or default template
- Widen shell metacharacters beyond Phase B allowlist
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-674): add testing.review gate evidence slot (#160 Phase C)`
