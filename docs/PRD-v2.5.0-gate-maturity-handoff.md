# pi-spine v2.5.0 — Gate Maturity Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.5.0 Gate Maturity  
**Last updated:** 2026-07-12  
**Status:** Ready for spine batch execution  

**Epic alias:** Phase 69 — SP-REL250 (SP-623+)

**Prerequisite:** v2.4.0 on `main` (`package.json` `2.4.0`); Phase 68 batch-meta recovery landed ([`PRD-v2.4.0-recovery-batch-meta-handoff.md`](PRD-v2.4.0-recovery-batch-meta-handoff.md)).

**Release profile:** minor — 12 S-sized tasks; 3 themed enhancements (#121, #122, #123) with **operator override** (minor ceiling 1–2 enh); 0 open bugs (allowed — no floor); detached batches only.

---

## 1. Executive summary

v2.4.0 closed [#126](https://github.com/beettlle/pi-spine/issues/126) (batch-meta persist + force-resume reconstruct) and finished leftover LOC splits. **Zero open bugs** remain. Nine open enhancements remain; operator selected the **gate maturity** cluster.

**v2.5.0** ships:

1. **[#121](https://github.com/beettlle/pi-spine/issues/121)** — `targetRevision` pinning so stale approvals cannot be used after underlying state changes  
2. **[#122](https://github.com/beettlle/pi-spine/issues/122)** — structured `{ code, message }` blockers for readiness/gate checks  
3. **[#123](https://github.com/beettlle/pi-spine/issues/123)** — category-based approval postures (split from M into 6×S), default **`locked`** so existing integrate gates stay manual  

**Tagline:** *Pin gate revisions — structure blockers — posture-aware approve with locked defaults — ship the minor.*

---

## 2. Scope lock

### In scope (Phase 69 — SP-REL250)

| FR | Description |
|----|-------------|
| FR-REL250-01 | Persist `targetRevision` on gate open/approve (#121) |
| FR-REL250-02 | Validate revision on gate use / integrate; re-approval on drift (#121) |
| FR-REL250-03 | `BlockerCode` + `{ code, message }` helpers (#122) |
| FR-REL250-04 | Emit structured blockers from gate/readiness paths (#122) |
| FR-REL250-05 | Categories + `DEFAULT_POSTURES` (#123) |
| FR-REL250-06 | Pure 5-tier posture evaluator (#123) |
| FR-REL250-07 | Config load for postures / `alwaysBreakOn` / `autoApproveAfterN` (#123) |
| FR-REL250-08 | Stamp `category` on gate open; default integrate → locked (#123) |
| FR-REL250-09 | Consecutive-approval streak persistence (#123) |
| FR-REL250-10 | Wire evaluator into approve/land-loop; journal auto vs human (#123) |
| FR-REL250-11 | Operator runbook for revision, blockers, postures |
| FR-REL250-12 | CONTEXT Phase 69 capstone + release note |

### Deferred (v2.5.1+ / later)

| Item | Rationale |
|------|-----------|
| [#160](https://github.com/beettlle/pi-spine/issues/160) | P3 stet gate evidence |
| [#135](https://github.com/beettlle/pi-spine/issues/135) | Dashboard DAG — M UX |
| [#127](https://github.com/beettlle/pi-spine/issues/127) | Mailbox steering |
| [#124](https://github.com/beettlle/pi-spine/issues/124) | Parallel wave strategies |
| [#120](https://github.com/beettlle/pi-spine/issues/120) | Journal SHA-256 integrity |
| [#43](https://github.com/beettlle/pi-spine/issues/43) | Monitoring epic |

### Non-goals

- Auto-approving integrate gates without explicit config opt-in  
- Weakening release-profile / `validateSequenceAutoApproveGate` fail-closed rules  
- Breaking public CLI/API without migration docs  
- npm publish without operator approval  

### Hard safety invariant (#123)

Existing integrate gates remain **`locked` by default** (always manual). Auto-approve only when config opts a category into permissive/cautious/guarded. `destroy` / `auth` never auto-approve. Release sequence profile stays gate-only for real pi.

---

## 3. Baseline

| Check | Value |
|-------|-------|
| Current version | `2.4.0` |
| Target | `2.5.0` (minor) |
| Next Task ID (pre-author) | SP-623 |
| Open bugs in scope | **0** |
| Open enh in scope | #121, #122, #123 |
| Pending SP-* | **0** |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| Gate FSM | [`src/batch/gate.mjs`](../src/batch/gate.mjs) (`openIntegrateGate`, `approveIntegrateGate`, `checkIntegrateGate`) |
| Gate I/O / scorecard | [`src/batch/gate-evidence-read.mjs`](../src/batch/gate-evidence-read.mjs) |
| Integrate | [`src/batch/integrate.mjs`](../src/batch/integrate.mjs) |
| Land-loop | [`src/batch/sequence-wait.mjs`](../src/batch/sequence-wait.mjs) |
| Auto-approve safety | [`src/doctor/sequence-safety.mjs`](../src/doctor/sequence-safety.mjs) |
| New modules | `blocker-codes.mjs`, `gate-posture-defaults.mjs`, `gate-posture-evaluate.mjs`, config helpers, streak store |
| Tests | `tests/batch/gate*.test.mjs`, new focused `node --test` files |
| Docs | [`docs/adoption/operator-runbook.md`](adoption/operator-runbook.md) |

**Explore:** [`spine-tasks/_explore/v2.5-gate-maturity/findings.md`](../spine-tasks/_explore/v2.5-gate-maturity/findings.md)

**Revision source (#121):** Prefer orch tip SHA (or durable batch revision counter) at gate open; store as `targetRevision`; fail closed if unreadable.

---

## 5. GitHub issue intake

| Issue | Priority | On `main` | v2.5.0 action | Task |
|-------|----------|-----------|---------------|------|
| [#121](https://github.com/beettlle/pi-spine/issues/121) | enh | Open | **Implement** (2 FRs) | SP-623–624 |
| [#122](https://github.com/beettlle/pi-spine/issues/122) | enh | Open | **Implement** (2 FRs) | SP-625–626 |
| [#123](https://github.com/beettlle/pi-spine/issues/123) | enh | Open | **Implement** (6 FRs; S splits) | SP-627–632 |
| [#160](https://github.com/beettlle/pi-spine/issues/160), [#135](https://github.com/beettlle/pi-spine/issues/135), [#127](https://github.com/beettlle/pi-spine/issues/127)–[#120](https://github.com/beettlle/pi-spine/issues/120), [#124](https://github.com/beettlle/pi-spine/issues/124), [#43](https://github.com/beettlle/pi-spine/issues/43) | enh/epic | Open | **Defer** | — |

---

## 6. Functional requirements

### FR-REL250-01 — Persist targetRevision (SP-623)

1. On gate open (and refresh if applicable), compute durable revision and store `targetRevision` on the gate record.  
2. Atomic save via existing gate I/O.  
3. Unit test asserts field present after open.

### FR-REL250-02 — Validate targetRevision (SP-624)

1. On approve-use / `checkIntegrateGate` / integrate path, compare current revision to `targetRevision`.  
2. On mismatch: fail closed; clear or reject stale approval; require re-open/re-approve.  
3. Regression tests for match and drift.

### FR-REL250-03 — Blocker types (SP-625)

1. New module with `BlockerCode` allow-list and `{ code, message }` helper.  
2. Codes cover integrate/readiness cases (missing gate, pending, rejected, stale revision, etc.).  
3. Pure unit tests; no wiring yet.

### FR-REL250-04 — Wire blockers (SP-626)

1. Gate check / readiness returns include structured blockers (keep human `message`).  
2. Backward compatible for string-only consumers.  
3. Tests assert codes on blocked paths.

### FR-REL250-05 — DEFAULT_POSTURES (SP-627)

1. Categories: read, write, execute, destroy, network, auth.  
2. Default postures table; destroy/auth locked.  
3. Pure data module + unit test of table shape.

### FR-REL250-06 — Evaluator (SP-628)

1. Pure 5-tier cascade: posture → never-auto → alwaysBreakOn → auto → autoApproveAfterN.  
2. No I/O; exhaustive unit tests.

### FR-REL250-07 — Config (SP-629)

1. Load/merge postures from spine-config with safe defaults.  
2. Invalid config fails closed to locked.  
3. Config unit tests.

### FR-REL250-08 — Stamp category (SP-630)

1. Stamp `category` on gate open; integrate defaults to locked posture category.  
2. Does not auto-approve.

### FR-REL250-09 — Streak counters (SP-631)

1. Persist consecutive approval counts for after-N thresholds.  
2. Reset on reject / category change as specified in tests.

### FR-REL250-10 — Wire approve (SP-632)

1. Wire evaluator into approve / land-loop when posture allows.  
2. Journal `decidedBy: auto` vs human; locked never auto.  
3. Preserve sequence-safety fail-closed for release/real-pi.

### FR-REL250-11 — Runbook (SP-633)

Document revision pinning, blocker codes, postures + locked defaults.

### FR-REL250-12 — CONTEXT capstone (SP-634)

Phase 69 table, Next Task ID → SP-635, PRD + manifest links, release note.

---

## 7. Task decomposition (SP-REL250 ↔ SP-ID)

| SP-ID | Slug | Mission | Size | Deps | Closes |
|-------|------|---------|------|------|--------|
| SP-623 | gate-target-revision-persist | FR-REL250-01 | S | — | Partial #121 |
| SP-624 | gate-target-revision-validate | FR-REL250-02 | S | SP-623 | **Closes #121** |
| SP-625 | blocker-codes-types | FR-REL250-03 | S | — | Partial #122 |
| SP-626 | blocker-codes-wire | FR-REL250-04 | S | SP-625 | **Closes #122** |
| SP-627 | gate-posture-defaults | FR-REL250-05 | S | — | Partial #123 |
| SP-628 | gate-posture-evaluator | FR-REL250-06 | S | SP-627 | Partial #123 |
| SP-629 | gate-posture-config | FR-REL250-07 | S | SP-627 | Partial #123 |
| SP-630 | gate-posture-stamp | FR-REL250-08 | S | SP-624, SP-627 | Partial #123 |
| SP-631 | gate-posture-streak | FR-REL250-09 | S | SP-629 | Partial #123 |
| SP-632 | gate-posture-wire-approve | FR-REL250-10 | S | SP-628, SP-630, SP-631 | **Closes #123** |
| SP-633 | runbook-gate-maturity | FR-REL250-11 | S | SP-624, SP-626, SP-632 | — |
| SP-634 | context-phase69-capstone | FR-REL250-12 | S | SP-623–633 | — |

---

## 8. Wave run order

```text
Wave 0 (parallel): SP-623, SP-625, SP-627
Wave 1: SP-624, SP-628 (and SP-626 if disjoint from SP-624; else after SP-624)
Wave 2: SP-629, SP-630
Wave 3: SP-631
Wave 4: SP-632
Wave 5: SP-633
Cap: SP-634
```

**Regression gate (per integrate):** `npm run release:check` with exit-code verification.

**Release execution:** spine-release-operator **minor** profile — detached batches only.

---

## 9. Exit criteria

- [ ] #121 closed — targetRevision persist + validate on use  
- [ ] #122 closed — structured blockers on gate/readiness paths  
- [ ] #123 closed — postures with locked defaults; optional auto-approve via config  
- [ ] Runbook documents all three  
- [ ] CONTEXT Phase 69 complete; Next Task ID → SP-635  
- [ ] `npm run release:check` green on publish HEAD  
- [ ] `npm version minor` → v2.5.0 published (operator-gated)  

---

## 10. Workflow after this document

```text
Packets: SP-623–634 (new)
Manifest: spine-tasks/_authoring/release-v2.5.0/manifest.md
Explore: spine-tasks/_explore/v2.5-gate-maturity/findings.md
```

```bash
spine tasks validate SP-623 SP-624 SP-625 SP-626 SP-627 SP-628 SP-629 SP-630 SP-631 SP-632 SP-633 SP-634
spine plan SP-623,SP-624,SP-625,SP-626,SP-627,SP-628,SP-629,SP-630,SP-631,SP-632,SP-633,SP-634
spine run sequence SP-623,SP-624,SP-625,SP-626,SP-627,SP-628,SP-629,SP-630,SP-631,SP-632,SP-633,SP-634 --dry-run
```

**Handoff after publish:** resume deferred enhancements (#160, #135, #127, #124, #120, #43) under next release profile.
