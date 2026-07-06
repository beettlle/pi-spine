# Task: SP-510 — Contract stet triage on non-zero findings

**Created:** 2026-07-06
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Extend `scripts/spine-stet-contract-run.sh` so sessions with findings do not auto-finish before operator triage, enabling `history.jsonl` accumulation for `stet optimize`. Touches contract script and operator docs; behavior change on non-zero finding paths only.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-510-stet-contract-triage-mode/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

When contract verify runs stet and **findings exist**, pause before `--auto-finish-zero` clears the session. Contract should fail with actionable triage instructions (`stet list`, `stet dismiss <id> <reason>`) so dismissals append to `.review/history.jsonl` and feed `stet optimize`.

Implements P1 "Feedback capture when findings exist" from the stet feedback-loop brief (SP-509).

## Dependencies

- **Task:** SP-509 (operator docs for feedback loop)

## Context to Read First

**Tier 2 (area context):**
- `docs/features/stet-feedback-loop-brief.md` (landed by SP-509)
- `docs/stet-overview.md` §1
- `scripts/spine-stet-contract-run.sh`

**Tier 3 (load only if needed):**
- [stet review-process-internals](https://github.com/beettlle/stet/blob/main/docs/review-process-internals.md)
- `.cursor/rules/stet-integration.mdc`

## Environment

- **Workspace:** `scripts/`
- **Services required:** `stet doctor` for manual verification; tests must not require live stet

## File Scope

- `scripts/spine-stet-contract-run.sh`
- `docs/adoption/operator-runbook.md`
- `tests/scripts/spine-stet-contract-run.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && node --test tests/scripts/spine-stet-contract-run.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `scripts/spine-stet-contract-run.sh` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read SP-509 brief and current `spine-stet-contract-run.sh`
- [ ] Confirm `--auto-finish-zero` behavior on zero vs non-zero findings
- [ ] SP-509 dependency satisfied

### Step 1: Detect non-zero findings before auto-finish

- [ ] After `stet run`, inspect findings count (JSON or `stet list` parsing)
- [ ] When findings > 0: do not auto-finish; exit non-zero with triage message
- [ ] When findings == 0: preserve current `--auto-finish-zero` behavior

**Artifacts:**
- `scripts/spine-stet-contract-run.sh`

### Step 2: Optional triage override env

- [ ] Support `SPINE_STET_NO_AUTO_FINISH=1` to keep session open for manual triage
- [ ] Document env in operator runbook §8.1

**Artifacts:**
- `scripts/spine-stet-contract-run.sh`, `docs/adoption/operator-runbook.md`

### Step 3: Tests

- [ ] Create `tests/scripts/spine-stet-contract-run.test.mjs` with mocked stet paths
- [ ] Cover zero-finding pass and non-zero fail paths
- [ ] Run: `node --test tests/scripts/spine-stet-contract-run.test.mjs`

**Artifacts:**
- `tests/scripts/spine-stet-contract-run.test.mjs`

### Step 4: Testing & Verification

- [ ] Run FULL contract: `npm run typecheck && node --test tests/scripts/spine-stet-contract-run.test.mjs`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77%**
- [ ] Manual smoke: document triage flow in STATUS.md if stet unavailable in CI

### Step 5: Documentation & Delivery

- [ ] Update operator runbook: contract failure → triage → dismiss → re-run
- [ ] Update brief P1 checklist in `docs/features/stet-feedback-loop-brief.md`
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` §8.1
- `docs/features/stet-feedback-loop-brief.md` (P1 items)

**Check If Affected:**
- `docs/stet-overview.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Zero-finding contract path unchanged
- [ ] Non-zero findings block contract with triage instructions
- [ ] Tests cover both paths

## Git Commit Convention

- **Step completion:** `feat(SP-510): complete Step N — description`
- **Bug fixes:** `fix(SP-510): description`

## Do NOT

- Change zero-finding auto-finish behavior
- Add gate-level stet (#160)
- Commit `.review/history.jsonl` to git
- Require live LM Studio in automated tests

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
