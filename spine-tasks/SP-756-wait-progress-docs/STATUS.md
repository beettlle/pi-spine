# SP-756: Document wait progress + agent guidance — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟢 Executing
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
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

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

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
