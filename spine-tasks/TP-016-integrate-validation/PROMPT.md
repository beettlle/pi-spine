# Task: TP-016 — Integrate validation + `spine integrate` (Phase 3)

**Created:** 2026-06-01
**Size:** M

> **Run first** (formerly sketched as "TP-016a") before TP-017 retry/skip.

## Review Level: 2 (Plan and Code)

**Assessment:** Closes the operator gap where batch merge succeeds but `main` never receives orch work.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Harden **post-batch landing** on `main`:

1. **Complete validation** — `spine batch complete` refuses when merge claims success but `orchBranch` is not ahead of `baseBranch` (and not already on base). Uses `countCommitsAhead` from TP-015.
2. **Reconciliation** — orch not on base → `needs_integrate`, `suggestedCommand: spine integrate`.
3. **`spine integrate`** — merge `orchBranch` → `baseBranch` (FR-INT-01); journal integrate events; gate stub (Phase 4). `--dry-run`.
4. **README** — batch complete → integrate → push `main`.

**Out of scope:** retry/skip (TP-017), abort (TP-018), multi-lane (TP-019).

**Success:** **80+** tests; wave 8 in `spine plan all`.

## Dependencies

- **TP-015**

## Context to Read First

- `docs/PRD.md` — FR-BATCH-16, FR-INT-01–05
- `src/batch/lifecycle.mjs`, `src/batch/reconcile.mjs`, `src/batch/lane-commit.mjs`

## File Scope

- `src/batch/integrate.mjs`, `src/batch/lifecycle.mjs`, `src/batch/reconcile.mjs`, `src/batch/diagnosis.mjs`
- `bin/spine-integrate.mjs`, `bin/spine.mjs`, `extensions/spine/slash-commands.ts`
- `tests/batch/integrate.test.mjs`, `tests/batch/lifecycle.test.mjs`, `README.md`

## Steps

### Step 0: Preflight
- [ ] TP-015 EmptyMerge on `main`; `spine preflight` clean

### Step 1: Integrate validation at complete
- [ ] `assertOrchIntegratable`; wire `completeBatch`; reconciliation `needs_integrate`

### Step 2: `spine integrate` CLI
- [ ] `integrateOrchToBase`; journal; `/spine-integrate`; tests

### Step 3: Documentation
- [ ] README runbook; CONTEXT TP-016 done

## Completion Criteria

- [ ] `complete` refuses empty orch; `spine integrate` works; tests pass

## Git Commit Convention

- `feat(TP-016): complete Step N — description`

## Do NOT

- TP-017 retry, TP-018 abort, TP-019 multi-lane, Phase 4 gates

---

## Amendments (Added During Execution)
