# Clarify: release-v2.3.0

**Date:** 2026-07-10
**Status:** complete

## Summary

v2.3.0 is the deferred FR-SHIP-02 batch module split epic (#117). Scope is **structural refactor only** — no feature work from the remaining open-issue backlog.

## Open questions

| # | Question | Resolution |
|---|----------|------------|
| 1 | Include monitoring epic #43 in v2.3.0? | **No** — defer to v2.3.1 |
| 2 | Include dashboard DAG #135? | **No** — defer to v2.3.1 |
| 3 | Include journal hardening #120? | **No** — defer; touches journal-rebuild split scope only as refactor |
| 4 | Include stet gate evidence #160? | **No** — P3 defer |
| 5 | Split-only vs mixed release? | **Split-only** — operator-approved epic scope |
| 6 | #117 lists 9 modules; verify lists 16? | **Use verify.mjs as source of truth** — explore documents all 16 |

## Assumptions

- Re-exports preserve all public exports from split modules
- Each split task removes its module from `PHASE23_GRANDFATHERED_OVER_500`
- `state.mjs` split (SP-587) runs after `reconcile.mjs` split (SP-578) due to import coupling
- `integrate.mjs` may drop below 500 LOC after `tryRestoreBranch` extract without full split

## Resolved decisions

1. **Epic scope:** SP-574–595 only; no ad-hoc issues added mid-release
2. **Behavior:** Zero functional changes; tests must pass unchanged
3. **Coverage:** ≥77% line coverage maintained on every code task
4. **Contract:** Scoped `node --test` per module — not bare `npm test` on S/M patches

## Blockers for decomposition

None.
