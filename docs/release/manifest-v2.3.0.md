# Release manifest — v2.3.0

**Created:** 2026-07-10
**Current version:** 2.2.0
**Target version:** v2.3.0
**Bump type:** minor
**Profile:** epic (operator-approved — exceeds minor 10–15 task budget)
**Operator approved scope:** pending

**Source PRD:** [`docs/PRD-v2.3.0-module-split-handoff.md`](../PRD-v2.3.0-module-split-handoff.md)

**Open-issue baseline:** 12 (`gh issue list --repo beettlle/pi-spine --state open`)

**Design decision:** Split-only epic — defer #43, #120–127, #135, #160 to v2.3.1+

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 4 | 2–4 | PASS |
| Bug fixes | 0 | 3–5 | WARN |
| Enhancements | 0 | 1–2 | WARN |
| Refactor | 15 | — | PASS (epic) |
| Sign-off | 3 | — | PASS |
| **Total tasks** | 32 | 10–15 minor | WARN |

**Profile audit:** PASS with operator override (epic scope; 32 tasks, all extract halves are S)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-574 | — | doc | S | v2.3.0 handoff PRD | Phase 65 spec |
| SP-575 | — | doc | S | v2.3.0 release manifest | Operator gate |
| SP-576 | FR-REL230-01 | infra | S | v2.3.0 regression gate | Partial |
| SP-577 | — | doc | S | module-split explore | Read-only |
| SP-578 | #117 | refactor | M | split reconcile.mjs | Partial |
| SP-579 | #117 | refactor | M | split review.mjs | Partial |
| SP-580 | #117 | refactor | M | split detached-start.mjs | Partial |
| SP-581 | #117 | refactor | M | split worker-host.mjs | Partial |
| SP-582 | #117 | refactor | M | split sequence.mjs | Partial |
| SP-583 | #117 | refactor | M | split lane-dirty-check.mjs | Partial |
| SP-584 | #117 | refactor | M | split journal-rebuild.mjs | Partial |
| SP-585 | #117 | refactor | M | split contract-verify.mjs | Partial |
| SP-586 | #117 | refactor | M | split attached-runner.mjs | Partial |
| SP-587 | #117 | refactor | M | split state.mjs | Partial |
| SP-588 | #117 | refactor | S | extract engine guards | Partial |
| SP-589 | #116 | refactor | S | integrate tryRestoreBranch | Closes |
| SP-590 | #117 | refactor | S | split resume-multi-lanes | Partial |
| SP-591 | #117 | refactor | M | split salvage-batch.mjs | Partial |
| SP-592 | #117 | refactor | S | monitor resume/lifecycle | Partial |
| SP-593 | #117 | refactor | S | empty grandfather list | Closes |
| SP-594 | #117,#116 | doc | S | GitHub hygiene | Hygiene |
| SP-595 | — | sign-off | S | CONTEXT Phase 65 capstone | — |

**Release scope ID:**

```text
SP-574,SP-575,SP-576,SP-577,SP-578,SP-579,SP-580,SP-581,SP-582,SP-583,SP-584,SP-585,SP-586,SP-587,SP-588,SP-589,SP-590,SP-591,SP-592,SP-593,SP-594,SP-595,SP-596,SP-597,SP-598,SP-599,SP-600,SP-601,SP-602,SP-603,SP-604,SP-605
```

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-574 SP-575 SP-576 SP-577 SP-578 SP-579 SP-580 SP-581 SP-582 SP-583 SP-584 SP-585 SP-586 SP-587 SP-588 SP-589 SP-590 SP-591 SP-592 SP-593 SP-594 SP-595 SP-596 SP-597 SP-598 SP-599 SP-600 SP-601 SP-602 SP-603 SP-604 SP-605
spine plan SP-574,SP-575,SP-576,SP-577,SP-578,SP-579,SP-580,SP-581,SP-582,SP-583,SP-584,SP-585,SP-586,SP-587,SP-588,SP-589,SP-590,SP-591,SP-592,SP-593,SP-594,SP-595,SP-596,SP-597,SP-598,SP-599,SP-600,SP-601,SP-602,SP-603,SP-604,SP-605
spine run sequence SP-574,SP-575,SP-576,SP-577,SP-578,SP-579,SP-580,SP-581,SP-582,SP-583,SP-584,SP-585,SP-586,SP-587,SP-588,SP-589,SP-590,SP-591,SP-592,SP-593,SP-594,SP-595,SP-596,SP-597,SP-598,SP-599,SP-600,SP-601,SP-602,SP-603,SP-604,SP-605 --detached
```

**Regression gate** (after each integrate wave):

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| [#43](https://github.com/beettlle/pi-spine/issues/43) | epic | Monitoring — v2.3.1 |
| [#120](https://github.com/beettlle/pi-spine/issues/120)–[#127](https://github.com/beettlle/pi-spine/issues/127) | roadmap | Gate maturity |
| [#135](https://github.com/beettlle/pi-spine/issues/135) | enh | Dashboard DAG — v2.3.1 |
| [#160](https://github.com/beettlle/pi-spine/issues/160) | enh | Stet gate evidence — P3 |

---

## Risks and blockers

- 32 tasks exceeds minor profile — operator override required
- `reconcile.mjs` at 1715 LOC — largest split; monitor SP-578/SP-596 duration
- `verify.mjs` edits deferred to SP-593 — splits run 4-wide without grandfather-list contention
- SP-587 depends on SP-596 (state/reconcile coupling)
- SP-593 must run after all splits complete (SP-578–605)

---

## Wave plan snapshot

Authoritative source: `spine plan` (2026-07-10) — 32 tasks · 13 waves · maxParallel 4.

```text
Wave 0 · SP-574 — v2.3.0 module split handoff PRD
Wave 1 · SP-575 — v2.3.0 release manifest
Wave 2 · SP-576, SP-577 — regression gate + batch module split explore (2 lanes)
Wave 3 · SP-578, SP-579, SP-580, SP-581 — first-half batch 1 (4 lanes)
Wave 4 · SP-596, SP-597, SP-598, SP-599 — second-half batch 1 (4 lanes)
Wave 5 · SP-582, SP-583, SP-584, SP-585, SP-587 — batch 2 first halves + state (5 tasks, 2 rounds)
Wave 6 · SP-589, SP-600, SP-601, SP-602, SP-603 — batch 2 second halves + integrate (5 tasks, 2 rounds)
Wave 7 · SP-586, SP-588, SP-591 — batch 3 first halves (3 lanes)
Wave 8 · SP-590, SP-604, SP-605 — batch 3 second halves + resume-multi (3 lanes)
Wave 9 · SP-592 — monitor resume and lifecycle LOC
Wave 10 · SP-593 — empty PHASE23_GRANDFATHERED_OVER_500
Wave 11 · SP-594 — v2.3.0 GitHub backlog hygiene
Wave 12 · SP-595 — CONTEXT Phase 65 capstone
```

Wave gates: SP-582–585 depend on SP-599; SP-586, SP-588, SP-591 depend on SP-603.

Run `spine plan SP-574,...,SP-605` for authoritative output.

---

## Publish checklist (Phase 5–6)

- [ ] Operator approved scope: pending
- [ ] All release-scoped tasks `.DONE` on `main` (SP-574–595)
- [ ] `npm run release:check` green on final HEAD
- [ ] `PHASE23_GRANDFATHERED_OVER_500` empty (SP-593)
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags` → `v2.3.0`
