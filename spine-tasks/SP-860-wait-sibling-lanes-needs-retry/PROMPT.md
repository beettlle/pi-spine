# Task: SP-860 — spine wait must not match needs_retry while sibling lanes still run

**Created:** 2026-11-16
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Agents wake the land loop under live sibling workers and may pause/salvage/kill healthy lanes.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `spine wait --until …,needs_retry` matches as soon as reconcile reports `needs_retry` for one failed task, even while another lane task is still `status: running`. Multi-lane dogfood (pi-smart-router / #375) woke too early; the sibling later finished `.DONE` after the wait exit.

## Mission

Closes #375 — For multi-lane batches, partial-failure diagnoses do not wake `spine wait` while non-failed siblings are still running:

1. **Match gate** — When `--until` includes `needs_retry` (and similarly partial-failure diagnoses if the same bug applies), `reconciliationMatchesUntil` (or the wait poll path that calls it) must **not** match while any in-scope task still has `status: "running"` (or an equivalently live lane worker). Once all non-failed tasks are terminal, `needs_retry` may match as today.
2. **Preserve other matches** — `completed`, `needs_integrate`, `failed`, `aborted`, and land-loop pseudos keep current behavior. A batch that is fully terminal-failed may still match `failed` / `needs_retry` without waiting for imaginary siblings.
3. **Tests** — Cover: one task `failed`/`contract_failed` + sibling `running` → wait does **not** match `needs_retry`; after sibling becomes terminal → match. Keep existing `tests/cli/wait.test.mjs` / `spine-wait-*.test.mjs` green.

Prefer fixing the wait match helper over changing global reconcile taxonomy headlines used by `spine status --diagnose` (diagnose may still show `needs_retry` while a sibling runs — wait must stay quiet).

## Dependencies

- **None**

## Context to Read First

- GitHub #375
- `src/cli/spine-wait.mjs` (`reconciliationMatchesUntil`, `diagnosisMatchesUntil`)
- `src/cli/wait.mjs` (poll loop)
- `tests/cli/wait.test.mjs`, `tests/cli/spine-wait-diagnosis.test.mjs`, `tests/cli/spine-wait-failed-match.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/cli/spine-wait.mjs`
- `src/cli/wait.mjs`
- `tests/cli/wait.test.mjs`
- `tests/cli/spine-wait-diagnosis.test.mjs`
- `tests/cli/spine-wait-failed-match.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/cli/wait.test.mjs tests/cli/spine-wait-diagnosis.test.mjs tests/cli/spine-wait-failed-match.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-860` |
| fileScopeMustChange | `src/cli/spine-wait.mjs`, `tests/cli/wait.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `reconciliationMatchesUntil` / wait poll; report blast radius in STATUS
- [ ] `rg -n "reconciliationMatchesUntil|needs_retry" tests/cli/`

### Step 1: Wait match gate

- [ ] Do not match `needs_retry` while any sibling task is still running
- [ ] Match once siblings are terminal

**Artifacts:**
- `src/cli/spine-wait.mjs` and/or `src/cli/wait.mjs` (modified)

### Step 2: Tests

- [ ] Sibling-running vs sibling-terminal cases

**Artifacts:**
- `tests/cli/wait.test.mjs` (and related wait tests as needed)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md (runbook owned by SP-857)
- [ ] Create `spine-tasks/SP-860-wait-sibling-lanes-needs-retry/.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-857 owns runbook)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — leave to SP-857

## Completion Criteria

- [ ] Wait does not exit on `needs_retry` while a sibling lane task is `running`
- [ ] Wait matches `needs_retry` once no sibling is running
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-860): wait ignores needs_retry while sibling lanes run`

## Do NOT

- Change diagnose headlines in a way that hides real `needs_retry` from operators
- Broaden to block `failed` forever when a zombie `running` bit is stuck — prefer the live task status already used by reconcile
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
