# SP-370: Wire per-type reviewer model into spawn — Status

**Current Step:** Complete
**Status:** ✅ Done
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-369 helpers exported
- [x] Read existing review-spawn tests

---

### Step 1: Wire spawn path
**Status:** ✅ Complete

- [x] Pass reviewType into buildReviewerPiArgs
- [x] Extend review-spawn tests: per-type override, fallback, inherit cascade

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Log spawn behavior notes in STATUS.md

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SP-369 `agent-model-resolve.mjs` not present in worktree at preflight | Landed minimal helpers inline so spawn wiring can import them | `src/config/agent-model-resolve.mjs` |
| Full suite: 1256/1257 pass; `contract-stall-override.test.mjs` flakes under parallel load (passes in isolation) | Pre-existing; unrelated to SP-370 | `tests/batch/contract-stall-override.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 0 preflight | SP-369 helpers missing; added resolve helpers per issue #53 sketch |
| 2026-06-30 | Step 1 wire spawn | `reviewType` passed through `buildReviewerPiArgs` / `spawnReviewerPi` |
| 2026-06-30 | Step 2 verification | typecheck OK; review-spawn 10/10; coverage 87.87% ≥ 77% |

---

## Blockers

*None*

---

## Notes

**Spawn behavior (issue #53):**

- `buildReviewerPiArgs` accepts `reviewType` (`plan`|`code`|`final`, default `code`).
- Model/thinking pins resolve via `resolveReviewerModelPin` / `resolveReviewerThinkingPin` cascade: `agents.reviewer.<type>.*` → top-level `agents.reviewer.*` → omit argv pin.
- `inherit` or missing pin omits `--model`; `off` or missing thinking omits `--thinking`.
- `spawnReviewerPi` forwards `reviewType` into `buildReviewerPiArgs` so plan/code/final spawns get distinct pins.
- Backward compatible: configs with only top-level `agents.reviewer.model` behave as before when `reviewType` is omitted or per-type blocks are absent.
