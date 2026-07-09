# Release manifest — v2.2.0

**Created:** 2026-07-09
**Current version:** 2.1.0
**Target version:** v2.2.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-09)

**Source PRD:** [`docs/PRD-v2.2.0-backlog-drain-handoff.md`](../PRD-v2.2.0-backlog-drain-handoff.md)

**Open-issue baseline:** 22 (`gh issue list --repo beettlle/pi-spine --state open`)

**Design decision (#190):** fail-closed — block promote/merge without committed `.DONE` on lane branch

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 | 2–4 | PASS |
| Bug fixes | 1 | 3–5 | WARN |
| Enhancements | 2 | 1–2 | PASS |
| Infrastructure | 3 | — | PASS |
| Sign-off | 1 | — | PASS |
| **Total tasks** | 9 | 10–15 | WARN |

**Profile audit:** PASS with operator override (9 tasks; bug count 1 below minimum — #190 treated as engine correctness)

**Operator buckets:**

| Bucket | Tasks |
|--------|-------|
| Infrastructure | SP-565, SP-566, SP-567 |
| Bug | SP-568, SP-569 |
| Enhancement | SP-570, SP-571 |
| Documentation | SP-572 |
| Sign-off | SP-573 |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-565 | — | infra | S | v2.2.0 backlog drain handoff PRD | Phase 64 spec |
| SP-566 | — | infra | S | v2.2.0 release manifest | Operator gate |
| SP-567 | FR-REL220-01 | infra | S | v2.2.0 regression gate script | Partial |
| SP-568 | #190 | bug | S | done-marker fail-closed explore | Read-only |
| SP-569 | #190 | bug | M | done-marker fail-closed engine | Closes |
| SP-570 | #158 | enh | S | operator salvage list CLI | Partial |
| SP-571 | #158 | enh | M | operator salvage integrate | Closes |
| SP-572 | #128,#129,#146–150,#175,#185 | doc | S | GitHub backlog hygiene | Hygiene |
| SP-573 | — | sign-off | S | CONTEXT Phase 64 capstone | — |

**Release scope ID:**

```text
SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573
```

---

## Sequence runner

```bash
spine tasks validate SP-565 SP-566 SP-567 SP-568 SP-569 SP-570 SP-571 SP-572 SP-573
spine plan SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573
spine run sequence SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573 --detached
```

**Regression gate:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check`

---

## Hygiene closure table (SP-572)

| Issue | Landed in | Status |
|-------|-----------|--------|
| #128 | SP-559 | pending |
| #129 | SP-561 | pending |
| #146–#150 | SP-558 | pending |
| #175 | SP-562 | pending |
| #185 | SP-560 | pending |
| #190 | SP-569 | pending |
| #158 | SP-571 | pending |

---

## Publish checklist (operator Phase 6)

- [ ] Operator approved scope: yes
- [ ] All manifest tasks `.DONE` on `main`
- [ ] `npm run release:check` green
- [ ] Open issues < 15
- [ ] `npm version minor` → 2.2.0
- [ ] `git push && git push --tags`
