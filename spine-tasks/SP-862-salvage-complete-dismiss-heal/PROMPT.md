# Task: SP-862 — After salvage --integrate, complete/dismiss succeed without --force

**Created:** 2026-11-16
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Operators who correctly salvage-land completed lane work still cannot archive the batch without `--force`, recreating closed #292 on v2.30.0.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** SP-763 / `healAfterSalvageLand` was supposed to promote salvaged tasks so `complete` / `dismiss` succeed. Dogfood on v2.30.0 (#374) still sees `complete`, `complete --detect-manual-merge`, and `dismiss` (without `--force`) refuse with `state_drift` / `needs_retry` after a successful `salvage --lane N --integrate` that landed `.DONE` work. Unrelated unresolved failures must still block.

## Mission

Closes #374 — Regression of #292 is fixed end-to-end:

1. **Heal completeness** — After successful `salvage --lane N --integrate` lands salvageable tasks, batch state + journal agree those tasks are succeeded (extend `healAfterSalvageLand` / integrate path if a gap remains — e.g. `state_drift`, pending-lane, or dismiss gates not covered by the existing heal).
2. **Complete / dismiss** — With no unresolved non-salvageable failures left, `spine batch complete`, `complete --detect-manual-merge`, and `spine batch dismiss` (no `--force`) succeed. `dismiss --force` remains available for true abandon paths.
3. **Keep fail-closed** — Non-salvageable failures (`contract_failed` without done evidence, etc.) still block complete/dismiss without `--force`.
4. **Tests** — Extend `tests/batch/salvage-complete-after-integrate.test.mjs` (and dismiss coverage if missing) for the #374 refuse modes that still reproduce.

## Dependencies

- **None** (if File Scope overlaps SP-861 hot files, plan will serialize)

## Context to Read First

- GitHub #374, #292
- `src/batch/salvage-batch-integrate-heal.mjs`
- `src/batch/salvage-batch-integrate.mjs`
- `src/batch/lifecycle.mjs` / `lifecycle-archive.mjs` (complete / dismiss)
- `tests/batch/salvage-complete-after-integrate.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/salvage-batch-integrate-heal.mjs`
- `src/batch/salvage-batch-integrate.mjs`
- `src/batch/lifecycle.mjs`
- `src/batch/lifecycle-archive.mjs`
- `tests/batch/salvage-complete-after-integrate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/salvage-complete-after-integrate.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-862` |
| fileScopeMustChange | `src/batch/salvage-batch-integrate-heal.mjs`, `tests/batch/salvage-complete-after-integrate.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `healAfterSalvageLand` / complete dismiss gates; report blast radius
- [ ] Reproduce the refuse path from #374 in the existing salvage-complete test harness (or document the missing case)

### Step 1: Heal / gate gap

- [ ] Close the v2.30.0 gap so salvaged-only batches can complete/dismiss without `--force`

**Artifacts:**
- heal / integrate / lifecycle files as needed

### Step 2: Tests

- [ ] complete, complete --detect-manual-merge, dismiss without --force after salvage land
- [ ] unresolved failure still blocks

**Artifacts:**
- `tests/batch/salvage-complete-after-integrate.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md (runbook owned by SP-857)
- [ ] Create `spine-tasks/SP-862-salvage-complete-dismiss-heal/.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-857 owns runbook)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — leave to SP-857

## Completion Criteria

- [ ] After salvage integrate with only salvageable failures, complete and dismiss succeed without `--force`
- [ ] Unresolved non-salvageable failures still block
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-862): complete/dismiss after salvage integrate without --force`

## Do NOT

- Make `dismiss --force` the documented happy path for salvage
- Heal non-salvageable contract/review failures into success
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
