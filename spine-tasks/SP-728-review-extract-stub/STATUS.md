# SP-728: Extract review-stub.mjs; pass stub queues via params — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟢 Complete (pending .DONE)
**Last Updated:** 2026-08-25
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: Extract stub queues

**Status:** ✅ Complete

- [x] Move stub verdict queue handling to `review-stub.mjs`
- [x] Pass queues via params; remove process.env mutation for stubs

## Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] Run contract `testCommand` only
- [x] Fix all failures from the scoped contract command

## Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| 2026-08-25 | Test helper `restoreEnv` in final-verdict/engine-code-review tests deleted short keys (e.g. `process.env.stub`) instead of real SPINE_* vars; only worked because the engine consumed queue env vars to "" | Fixed restoreEnv with short-key → env-name map in both test files; required by the no-mutation change |
| 2026-08-25 | tests/adoption/replan-needs-replan.test.mjs fails on pristine baseline (pre-existing, env-dependent adoption test) | Out of scope; not in contract testCommand |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-25 | Task staged | PROMPT.md and STATUS.md created for v2.16.0 release |
| 2026-08-25 | Step 1 complete | Extracted stub queues to review-stub.mjs; queues materialized per phase and passed via params; no process.env mutation |
| 2026-08-25 | Step 2 complete | Contract testCommand green: typecheck OK; final-verdict + review-retry-reconcile 17/17 pass |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
