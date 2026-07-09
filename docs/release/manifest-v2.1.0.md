# Release manifest — v2.1.0 (backlog drain)

**Created:** 2026-07-09
**Current version:** 2.0.0
**Target version:** v2.1.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** no

**Source PRD:** [`docs/PRD-v2.1.0-backlog-drain-handoff.md`](../PRD-v2.1.0-backlog-drain-handoff.md)

**Open-issue baseline:** 29 (`gh issue list --repo beettlle/pi-spine --state open`)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 4 | 2–4 | PASS |
| Bug fixes | 2 | 3–5 | WARN |
| Enhancements | 4 | 1–2 | WARN (operator override) |
| Infrastructure | 2 | — | PASS |
| Sign-off | 2 | — | PASS |
| **Total tasks** | 13 | 10–15 | PASS |

**Profile audit:** PASS with operator override (4 enhancements; bug count 2 — acceptable for backlog drain)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-552 | — | doc | S | v2.1.0 handoff PRD | — |
| SP-553 | — | infra | S | v2.1.0 release manifest | This task |
| SP-554 | — | infra | S | v2.1.0 regression gate script | dep SP-553 |
| SP-555 | #169 | bug | S | worktree cleanup completion | Closes |
| SP-556 | #157 | enh | S | CI guard reconcile cwd tests | Closes |
| SP-557 | #148 | enh | S | duplicate step validator | Closes |
| SP-558 | #146–150 | doc | S | skill authoring polish | Partial |
| SP-559 | #128 | enh | S | doctor duplicate install | Closes |
| SP-560 | #185 | bug+doc | S | agent detached UX | Closes |
| SP-561 | #129 | doc | S | maturity matrix | Closes |
| SP-562 | #175 | enh | S | preversion release:check hook | Partial |
| SP-563 | hygiene | doc | S | GitHub backlog hygiene | — |
| SP-564 | — | sign-off | S | CONTEXT Phase 63 capstone | — |

**Release scope ID:**

```text
SP-552,SP-553,SP-554,SP-555,SP-556,SP-557,SP-558,SP-559,SP-560,SP-561,SP-562,SP-563,SP-564
```

---

## Wave plan snapshot

```text
Wave 0: SP-552, SP-553
Wave 1: SP-554, SP-555, SP-556, SP-557 (parallel where disjoint)
Wave 2: SP-558, SP-559, SP-560, SP-561
Wave 3: SP-562
Wave 4: SP-563
Wave 5: SP-564
```

Run `spine plan SP-552,...,SP-564` after validate for authoritative waves.

---

## Deferred backlog

| Item | Rationale |
|------|-----------|
| #43, #117 | Epics |
| #120–#127, #135, #158, #160 | v2.2+ roadmap |

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `npm run release:check` green
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push --tags`
- [ ] Open issues decreased vs baseline 29
