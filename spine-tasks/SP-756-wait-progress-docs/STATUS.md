# SP-756: Document wait progress + agent guidance — Status

**Current Step:** Complete
**Status:** ✅ Done — awaiting engine review/merge
**Last Updated:** 2026-09-13
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-753/SP-754 `.DONE` and wait stdout behavior on `main`
- [x] Dependencies satisfied

---

### Step 1: Document wait UX
**Status:** ✅ Complete

- [x] QUICK-REFERENCE: note human-mode start/progress/match lines; when to use `--json`
- [x] spine-release-operator: detached wait guidance mentions progress
- [x] spine-orchestrate-waves: wait recipe mentions liveness output
- [x] agent-shell-batch-policy: quiet-stdout agent hosts vs wait progress

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Contract `testCommand` is `true` (docs-only)
- [x] Spot-check linked examples still use valid `--until` lists

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `npm test` inside a worker session fails 43 batch-engine tests with `nested_batch_spawn_blocked` — `SPINE_IS_WORKER=1` env leaks into spawned test processes | Environmental, not a regression; suite passes 2622/2622 with worker env vars cleared (`env -u SPINE_IS_WORKER … npm test`) | tests/spine-run.test.mjs et al. |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |
| 2026-09-13 | Step 0 | SP-753/SP-754 confirmed landed (wave-0 integrate `39bba516`, SP-754 `10715653`/`6bb3bca7`); live wait output verified (banner + progress + timeout headline) |
| 2026-09-13 | Step 1 | All four File Scope files updated; commit `38e033fe` |
| 2026-09-13 | Step 2 | All `--until` lists validate via `parseUntilDiagnoses`; `env -u SPINE_IS_WORKER … npm test` → 2622/2622 pass, exit 0; commit `4484adc3` |
| 2026-09-13 | Step 3 | Contract checked: 0 src/bin changes, must-change paths modified; `.DONE` created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
