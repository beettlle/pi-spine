# Task: SP-608 — Diagnose gate-ready headline

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Prefer current gate-ready diagnosis over historical merge/gitignored headline inputs.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #195 — When a batch has recovered to gate-ready (all tasks terminal-success, integrate gate open / diagnosis `needs_integrate`), `spine watch` and diagnose must **not** headline a recovered gitignored merge block or a historical merge conflict. Prefer gate-approve messaging; keep historical merge failures in signals/history only.

**Source:** [`docs/PRD-v2.3.1-reliability-handoff.md`](../../docs/PRD-v2.3.1-reliability-handoff.md) §6 FR-REL231-01

## Dependencies

- **None**

## Context to Read First

- [`src/batch/diagnosis.mjs`](../../src/batch/diagnosis.mjs) — `buildHeadline`
- [`src/batch/reconcile-batch.mjs`](../../src/batch/reconcile-batch.mjs) — `mergeGitignoredFailure` / `mergeFailed` signals
- [`tests/batch/diagnosis.test.mjs`](../../tests/batch/diagnosis.test.mjs)
- [`tests/batch/merge-failure-diagnosis.test.mjs`](../../tests/batch/merge-failure-diagnosis.test.mjs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/reconcile-batch.mjs`
- `tests/batch/diagnosis.test.mjs`
- `tests/batch/merge-failure-diagnosis.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/diagnosis.test.mjs tests/batch/merge-failure-diagnosis.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce stale-headline path from #195 (gate open + historical merge/gitignored ctx)
- [ ] Identify where `mergeGitignoredFailure` / `mergeFailed` outrank `needs_integrate`

### Step 1: Prefer gate-ready headline

- [ ] When diagnosis is `needs_integrate` (or allTasksTerminalSuccess + integrate gate open), do not return gitignored/merge-failed headlines as primary
- [ ] Ensure `suggestedCommand` aligns with gate approve / land loop when gate-ready
- [ ] Demote or clear superseded merge/gitignored headline inputs once wave merge succeeded / lastError cleared

### Step 2: Testing & Verification

- [ ] Add/extend tests: gate-ready + stale merge/gitignored context → gate-ready headline
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if diagnose recovery copy changes

## Completion Criteria

- [ ] Gate-ready batches headline integrate/gate messaging, not recovered merge/gitignored blocks
- [ ] Regression tests cover the #195 scenario
- [ ] Issue #195 closable after land

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Change worker teardown or lane sync (SP-609 / SP-610)

## Git Commit Convention

- `fix(SP-608): prefer gate-ready headline over stale merge signals`
