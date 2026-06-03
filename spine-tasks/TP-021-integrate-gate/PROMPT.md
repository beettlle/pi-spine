# Task: TP-021 — Integrate gate FSM + evidence bundle (Phase 4)

**Created:** 2026-06-01
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Replaces TP-016 integrate gate stub with real fail-closed gate; evidence collection touches batch complete path.
**Score:** 6/8

## Mission

Implement **§12 Human gates** for integrate:

1. **Gate FSM** — `pending` → `approved` | `rejected`; persist under `.spine/runtime/{batchId}/gate.json` (or batch-state extension).
2. **Auto-open integrate gate** when batch reaches terminal success and orch is ready (AC-4.1).
3. **Evidence bundle** (§12.2) — `.spine/runtime/{batchId}/evidence/`: `summary.md`, `diff-stat.txt`, optional test/build output from `.pi/taskplane-config.json` testing commands.
4. **`spine gate`** / **`/spine-gate [approve|reject|status]`** — inspect and resolve gate.
5. **Enforce on integrate** — replace `checkIntegrateGateStub` in `integrate.mjs`; `/spine-integrate` exit 2 when not approved (§12.4); `--force-integrate` only with `SPINE_ALLOW_FORCE=1` + journal.
6. Journal — `gate.opened`, `gate.approved`, `gate.rejected`, `integrate.failed` on gate block.

**Out of scope:** post-mortem generator (TP-022 fills `summary.md` content upgrade), dashboard.

**Success:** Integrate blocked until approve; evidence dir populated; **120+** tests; wave 13.

## Dependencies

- **TP-020**

## Context to Read First

- `docs/PRD.md` — §12, FR-INT-02, AC-4.1–4.3
- `src/batch/integrate.mjs`, `src/batch/lifecycle.mjs`, `src/batch/engine.mjs`

## File Scope

- `src/batch/gate.mjs` (new)
- `src/batch/evidence.mjs` (new)
- `src/batch/integrate.mjs`, `src/batch/lifecycle.mjs`, `src/batch/engine.mjs`
- `bin/spine-gate.mjs` (new), `bin/spine.mjs`, `extensions/spine/slash-commands.ts`
- `tests/batch/gate.test.mjs`, `tests/batch/integrate.test.mjs` (extend)
- `README.md`

## Steps

### Step 0: Preflight
- [ ] §12 read; TP-016 stub behavior on `main`

### Step 1: Gate FSM + persistence
### Step 2: Evidence collection on batch complete
### Step 3: spine gate CLI + integrate enforcement
### Step 4: Tests + docs

## Completion Criteria

- [ ] Integrate fails until gate approved; evidence bundle exists
- [ ] Tests pass (**120+**)

## Git Commit Convention

- `feat(TP-021): complete Step N — description`

## Do NOT

- Dashboard (Phase 5); rewrite review (TP-020)

---

## Amendments (Added During Execution)
