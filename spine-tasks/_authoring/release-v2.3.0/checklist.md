# Requirements checklist: release-v2.3.0

**Date:** 2026-07-10
**Status:** complete

## Acceptance criteria quality

| ID | Criterion | Status |
|----|-----------|--------|
| AC-01 | Each split module ≤500 LOC after task completes | [OK] measurable via `wc -l` + verify |
| AC-02 | `PHASE23_GRANDFATHERED_OVER_500` empty at SP-593 | [OK] |
| AC-03 | All existing batch tests pass without behavior change | [OK] full suite in Testing step |
| AC-04 | No new import cycles | [OK] SP-432 arch guard |
| AC-05 | Public API preserved via re-exports | [OK] per SP-507 pattern |

## Security

| ID | Item | Status |
|----|------|--------|
| SEC-01 | No auth/crypto surface in refactor | [OK] N/A |
| SEC-02 | Contract-verify split preserves npm guard (SP-541) | [Gap → defer to SP-585 implementation] |

## Edge cases

| ID | Case | Covered by |
|----|------|------------|
| EC-01 | Module still >500 after first extract | SP-592 monitor task |
| EC-02 | resume.mjs borderline at 506 LOC | SP-592 |
| EC-03 | detached-spawn.mjs already extracted | SP-580 explore note |
| EC-04 | Parallel lane cumulative contract diff | disjoint file scopes per task |

## Testability

| ID | Item | Status |
|----|------|--------|
| T-01 | Scoped test per module in Contract | [OK] |
| T-02 | Full suite in Testing step every task | [OK] |
| T-03 | verify.mjs batch-loc-policy as final gate | [OK] SP-593 |

## Non-functional requirements

| ID | NFR | Status |
|----|-----|--------|
| NFR-01 | ≥77% line coverage | [OK] |
| NFR-02 | ≤4 M tasks per wave | [OK] wave plan §10 |
| NFR-03 | Operator manifest approval before wave 2 | [OK] SP-575 |

## Gaps

None blocking decomposition. SEC-02 resolved during SP-585 implementation.
