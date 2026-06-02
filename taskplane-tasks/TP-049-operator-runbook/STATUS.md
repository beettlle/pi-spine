# TP-049 Status

**Task:** Operator runbook for real projects
**Started:** 2026-06-02
**Last Updated:** 2026-06-02

## Progress

### Step 1: Draft runbook
**Status:** ✅ Complete

- [x] All sections with copy-paste commands
- [x] Land loop diagram (mermaid)

### Step 2: Cross-link + CONTEXT update
**Status:** ✅ Complete

- [x] README + readiness doc links
- [x] CONTEXT Phase 9 policy points to runbook

### Step 3: Verification
**Status:** ✅ Complete

- [x] Peer review: runbook is self-contained with bootstrap checklist + local-install links
- [x] `npm run typecheck` pass; `SPINE_WORKER_STUB=1 npm test` — 319/321 pass (2 pre-existing flaky doctor tests in this environment: `env-overrides.test.mjs`, `stale-path.test.mjs`)

## Commits

- `53a64ae` feat(TP-049): draft operator runbook for real projects
- `b2c98c0` feat(TP-049): cross-link operator runbook in adoption docs
